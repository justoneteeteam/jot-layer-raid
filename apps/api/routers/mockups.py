"""Mockup template routes — separation, CRUD, and layer management."""

import io
import uuid
import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from models.mockup_template import MockupTemplate
from services.r2_storage import upload_file_to_r2, get_presigned_url
from services.qwen_separator import separate_jersey, SeparationResult

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/mockups", tags=["mockups"])


# ── Pydantic Schemas ─────────────────────────────────────────────────────────

class SeparationResponse(BaseModel):
    job_id: str
    status: str
    message: str


class SeparationStatusResponse(BaseModel):
    status: str
    step: Optional[str] = None
    message: Optional[str] = None
    result: Optional[dict] = None


class TemplateCreateRequest(BaseModel):
    team_id: int
    name: str
    color_variant: Optional[str] = None


class TemplateResponse(BaseModel):
    id: int
    name: str
    team_id: int
    color_variant: Optional[str]
    original_image_url: Optional[str]
    blank_image_url: Optional[str]
    name_layer_url: Optional[str]
    number_layer_url: Optional[str]
    text_positions: Optional[dict]
    separation_status: str

    class Config:
        from_attributes = True


# ── In-memory job tracking (for non-Celery sync mode) ────────────────────────
# In production, this would be handled by Celery task state.
# For now, we use a simple dict to track separation jobs.

_separation_jobs: dict[str, dict] = {}


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/separate", response_model=SeparationResponse)
async def start_separation(
    file: UploadFile = File(...),
    team_id: int = Form(default=0),
    template_name: str = Form(default=""),
    db: Session = Depends(get_db),
):
    """
    Upload a jersey image and start the hybrid separation pipeline.
    
    Runs synchronously for now (takes ~30-60s).
    Returns the separation result with R2 keys for all layers.
    """
    # Validate file
    if file.content_type not in ("image/png", "image/jpeg", "image/jpg"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PNG and JPEG images are accepted",
        )

    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be under 10 MB",
        )

    job_id = str(uuid.uuid4())[:8]

    # Create a MockupTemplate record
    template = MockupTemplate(
        team_id=team_id if team_id > 0 else None,
        name=template_name or f"Separation {job_id}",
        separation_status="processing",
    )
    db.add(template)
    db.commit()
    db.refresh(template)

    # Upload original image to R2
    original_key = f"mockups/{template.id}/original.png"
    upload_file_to_r2(original_key, image_bytes, "image/png")
    template.original_image_url = original_key
    db.commit()

    # Track the job
    _separation_jobs[job_id] = {
        "template_id": template.id,
        "status": "processing",
        "step": "starting",
        "message": "Initiating separation pipeline...",
    }

    # Run synchronously (for simplicity; switch to Celery task for production)
    try:
        def on_progress(step: str, msg: str):
            _separation_jobs[job_id]["step"] = step
            _separation_jobs[job_id]["message"] = msg
            template.separation_status = step
            db.commit()

        result = separate_jersey(
            image_bytes=image_bytes,
            r2_prefix=f"mockups/{template.id}",
            job_id=str(template.id),
            progress_callback=on_progress,
        )

        if result.error:
            template.separation_status = "failed"
            db.commit()
            _separation_jobs[job_id]["status"] = "failed"
            _separation_jobs[job_id]["message"] = result.error
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Separation failed: {result.error}",
            )

        # Update template with results
        template.blank_image_url = result.blank_jersey_key
        template.name_layer_url = result.name_layer_key
        template.number_layer_url = result.number_layer_key
        template.text_positions = result.text_positions
        template.separation_status = "done"
        db.commit()

        _separation_jobs[job_id] = {
            "template_id": template.id,
            "status": "done",
            "step": "done",
            "message": "Separation complete!",
            "result": {
                "template_id": template.id,
                "blank_key": result.blank_jersey_key,
                "name_key": result.name_layer_key,
                "number_key": result.number_layer_key,
                "text_positions": result.text_positions,
                "cost_cents": result.cost_cents,
                "detected_regions": result.detected_regions,
            }
        }

        return SeparationResponse(
            job_id=job_id,
            status="done",
            message="Separation complete!",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Separation failed: {e}")
        template.separation_status = "failed"
        db.commit()
        _separation_jobs[job_id]["status"] = "failed"
        _separation_jobs[job_id]["message"] = str(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/separate/{job_id}/status", response_model=SeparationStatusResponse)
def get_separation_status(job_id: str):
    """Poll for separation progress."""
    job = _separation_jobs.get(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )
    return SeparationStatusResponse(
        status=job["status"],
        step=job.get("step"),
        message=job.get("message"),
        result=job.get("result"),
    )


@router.get("/templates", response_model=list[TemplateResponse])
def list_templates(db: Session = Depends(get_db)):
    """List all mockup templates."""
    templates = db.query(MockupTemplate).all()
    return templates


@router.get("/templates/{template_id}", response_model=TemplateResponse)
def get_template(template_id: int, db: Session = Depends(get_db)):
    """Get a specific mockup template."""
    template = db.query(MockupTemplate).filter(MockupTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.get("/templates/{template_id}/layers")
def get_template_layers(template_id: int, db: Session = Depends(get_db)):
    """Get presigned URLs for all layers of a template."""
    template = db.query(MockupTemplate).filter(MockupTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    layers = {}
    if template.original_image_url:
        layers["original"] = get_presigned_url(template.original_image_url)
    if template.blank_image_url:
        layers["blank"] = get_presigned_url(template.blank_image_url)
    if template.name_layer_url:
        layers["name"] = get_presigned_url(template.name_layer_url)
    if template.number_layer_url:
        layers["number"] = get_presigned_url(template.number_layer_url)

    return {
        "template_id": template_id,
        "separation_status": template.separation_status,
        "text_positions": template.text_positions,
        "layers": layers,
    }


@router.get("/job/{job_id}/layers")
def get_job_layers(job_id: str):
    """Get presigned URLs for layers from a completed separation job."""
    job = _separation_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["status"] != "done":
        raise HTTPException(status_code=400, detail=f"Job not complete: {job['status']}")

    result = job.get("result", {})
    layers = {}

    for key_name, label in [("blank_key", "blank"), ("name_key", "name"), ("number_key", "number")]:
        r2_key = result.get(key_name)
        if r2_key:
            layers[label] = get_presigned_url(r2_key)

    return {
        "template_id": result.get("template_id"),
        "text_positions": result.get("text_positions"),
        "detected_regions": result.get("detected_regions"),
        "cost_cents": result.get("cost_cents"),
        "layers": layers,
    }
