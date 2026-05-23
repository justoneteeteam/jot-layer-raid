from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
import io
from sqlalchemy.orm import Session
from database import get_db
from models.patch import Patch
from services.r2_storage import upload_file_to_r2, get_presigned_url
import uuid

router = APIRouter(prefix="/api/patches", tags=["Patches"])


@router.get("")
def list_patches(
    request: Request,
    db: Session = Depends(get_db)
):
    """List all patches."""
    patches = db.query(Patch).all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "image_url": f"{request.base_url}api/patches/{p.id}/download" if p.image_url else "",
            "width": p.width,
            "height": p.height,
        }
        for p in patches
    ]


@router.post("/upload")
async def upload_patches(
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    """Upload one or more patch images to R2 and save metadata."""
    results = []
    for file in files:
        data = await file.read()
        ext = file.filename.rsplit(".", 1)[-1] if file.filename else "png"
        key = f"patches/{uuid.uuid4().hex}.{ext}"
        content_type = f"image/{ext}" if ext != "svg" else "image/svg+xml"

        upload_file_to_r2(key, data, content_type=content_type)

        name = file.filename.rsplit(".", 1)[0] if file.filename else "Unnamed"
        patch = Patch(name=name, image_url=key)
        db.add(patch)
        db.commit()
        db.refresh(patch)
        results.append({"id": patch.id, "name": patch.name, "image_url": key})

    return {"uploaded": len(results), "patches": results}


@router.delete("/{patch_id}")
def delete_patch(patch_id: int, db: Session = Depends(get_db)):
    """Delete a patch by ID."""
    patch = db.query(Patch).filter(Patch.id == patch_id).first()
    if not patch:
        raise HTTPException(status_code=404, detail="Patch not found")
    db.delete(patch)
    db.commit()
    return {"deleted": patch_id}


@router.get("/{patch_id}/download")
def download_patch(patch_id: int, db: Session = Depends(get_db)):
    """Serve/download the patch image directly from R2 to bypass CORS issues."""
    patch = db.query(Patch).filter(Patch.id == patch_id).first()
    if not patch or not patch.image_url:
        raise HTTPException(status_code=404, detail="Patch not found")
        
    try:
        from services.r2_storage import get_r2_client
        from config import settings
        
        client = get_r2_client()
        response = client.get_object(Bucket=settings.R2_BUCKET_NAME, Key=patch.image_url)
        data = response["Body"].read()
        
        # Determine content type
        content_type = "image/png"
        ext = patch.image_url.rsplit(".", 1)[-1].lower()
        if ext in ("jpg", "jpeg"):
            content_type = "image/jpeg"
        elif ext == "webp":
            content_type = "image/webp"
        elif ext == "svg":
            content_type = "image/svg+xml"
            
        return StreamingResponse(io.BytesIO(data), media_type=content_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error downloading patch: {str(e)}")
