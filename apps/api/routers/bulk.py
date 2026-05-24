"""Bulk Job Router: Handles creating bulk mockup generation jobs and tracking their database progress."""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from database import get_db
from models.bulk_job import BulkJob, BulkJobItem
from models.player import Player
from models.store import Store
from models.mockup_template import MockupTemplate

router = APIRouter(prefix="/api/bulk", tags=["Bulk Jobs"])


# ── Pydantic Request/Response Schemas ─────────────────────────────────────────

class BulkJobCreateRequest(BaseModel):
    name: Optional[str] = None
    team_id: int
    template_id: int
    player_ids: List[int]
    sizes: List[str]
    store_id: int
    seo_title_pattern: str
    seo_description_html: str
    seo_category: str
    seo_tags: str


class BulkJobItemResponse(BaseModel):
    id: int
    player_id: int
    mockup_template_id: int
    gender: str
    status: str
    generated_image_url: Optional[str]
    product_title: Optional[str]
    error_message: Optional[str]

    class Config:
        from_attributes = True


class BulkJobResponse(BaseModel):
    id: int
    status: str
    total_items: int
    completed_items: int
    failed_items: int
    store_targets: list
    seo_template: dict
    created_at: str
    completed_at: Optional[str] = None
    items: List[BulkJobItemResponse] = []

    class Config:
        from_attributes = True


# ── Router Endpoints ──────────────────────────────────────────────────────────

@router.post("/jobs", status_code=status.HTTP_201_CREATED)
def trigger_bulk_job(req: BulkJobCreateRequest, db: Session = Depends(get_db)):
    """Trigger a new bulk generation and store upload run."""
    # 1. Verify resources
    template = db.query(MockupTemplate).filter(MockupTemplate.id == req.template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Mockup template not found")

    store = db.query(Store).filter(Store.id == req.store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Target store connection not found")

    # 2. Extract unique genders from selected sizes (Men, Women, Youth)
    selected_genders = set()
    for size in req.sizes:
        lower_size = size.lower()
        if "men" in lower_size:
            selected_genders.add("Men")
        elif "women" in lower_size:
            selected_genders.add("Women")
        elif "youth" in lower_size:
            selected_genders.add("Youth")
            
    if not selected_genders:
        # Default fallback if sizes were passed as plain S, M, L etc.
        selected_genders.add("Men")

    # 3. Create the parent BulkJob record
    bulk_job = BulkJob(
        status="pending",
        total_items=len(req.player_ids) * len(selected_genders),
        completed_items=0,
        failed_items=0,
        store_targets=[{"store_id": store.id, "name": store.name, "platform": store.platform}],
        seo_template={
            "title_pattern": req.seo_title_pattern,
            "description_pattern": req.seo_description_html,
            "category_pattern": req.seo_category,
            "tags_pattern": req.seo_tags,
            "sizes": req.sizes,
        }
    )
    db.add(bulk_job)
    db.flush()  # Extract bulk_job.id

    # 4. Generate all item permutations (Player * Gender)
    for player_id in req.player_ids:
        player = db.query(Player).filter(Player.id == player_id).first()
        if not player:
            continue
            
        for gender in selected_genders:
            item = BulkJobItem(
                job_id=bulk_job.id,
                player_id=player.id,
                mockup_template_id=template.id,
                gender=gender,
                status="pending",
            )
            db.add(item)

    db.commit()
    db.refresh(bulk_job)

    # 5. Trigger the background Celery/process task
    try:
        from tasks import run_bulk_job
        # Trigger asynchronously (non-blocking)
        run_bulk_job.delay(bulk_job.id)
    except Exception as e:
        # Fallback to local synchronous background execution if Celery/Redis is down
        print(f"Celery trigger failed ({e}), falling back to direct background thread...")
        import threading
        t = threading.Thread(target=run_bulk_job, args=(bulk_job.id,))
        t.start()

    return {"message": "Bulk job triggered successfully", "job_id": bulk_job.id}


@router.get("/jobs")
def list_bulk_jobs(db: Session = Depends(get_db)):
    """List all bulk mockup generation jobs."""
    jobs = db.query(BulkJob).order_by(BulkJob.id.desc()).all()
    return [
        {
            "id": j.id,
            "name": f"Bulk Job #{j.id}",
            "status": j.status,
            "total": j.total_items,
            "done": j.completed_items,
            "created": j.created_at.strftime("%Y-%m-%d %H:%M") if j.created_at else None,
            "store": j.store_targets[0]["name"] if j.store_targets else "None",
            "template_name": "Jersey Mockup",
        }
        for j in jobs
    ]


@router.get("/jobs/{job_id}")
def get_bulk_job(job_id: int, db: Session = Depends(get_db)):
    """Retrieve full details, logs, and progress metrics of a specific bulk job."""
    job = db.query(BulkJob).filter(BulkJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Bulk job not found")

    items = db.query(BulkJobItem).filter(BulkJobItem.job_id == job_id).all()
    
    return {
        "id": job.id,
        "status": job.status,
        "total_items": job.total_items,
        "completed_items": job.completed_items,
        "failed_items": job.failed_items,
        "store_targets": job.store_targets,
        "seo_template": job.seo_template,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "items": [
            {
                "id": it.id,
                "player_id": it.player_id,
                "player_name": db.query(Player.name).filter(Player.id == it.player_id).scalar() or "Unknown",
                "gender": it.gender,
                "status": it.status,
                "generated_image_url": it.generated_image_url,
                "product_title": it.product_title,
                "error_message": it.error_message,
            }
            for it in items
        ]
    }
