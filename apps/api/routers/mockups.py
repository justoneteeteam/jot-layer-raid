"""Mockup template routes — direct image upload and canvas JSON saving."""

import uuid
import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from models.mockup_template import MockupTemplate
from services.r2_storage import upload_file_to_r2, get_presigned_url

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/mockups", tags=["mockups"])


# ── Pydantic Schemas ─────────────────────────────────────────────────────────

class TemplateCreateRequest(BaseModel):
    team_id: Optional[int] = None
    name: str
    color_variant: Optional[str] = None


class TemplateUpdateRequest(BaseModel):
    canvas_json: Optional[dict] = None
    font_config: Optional[dict] = None
    background_color: Optional[str] = None


class TemplateResponse(BaseModel):
    id: int
    name: str
    team_id: Optional[int]
    color_variant: Optional[str]
    original_image_url: Optional[str]
    font_config: Optional[dict]
    canvas_json: Optional[dict]
    background_color: Optional[str]

    class Config:
        from_attributes = True


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/templates", response_model=TemplateResponse)
def create_template(req: TemplateCreateRequest, db: Session = Depends(get_db)):
    """Create a new mockup template record."""
    template = MockupTemplate(
        team_id=req.team_id if req.team_id and req.team_id > 0 else None,
        name=req.name,
        color_variant=req.color_variant,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.put("/templates/{template_id}", response_model=TemplateResponse)
def update_template(template_id: int, req: TemplateUpdateRequest, db: Session = Depends(get_db)):
    """Save the canvas JSON, font config, and background color."""
    template = db.query(MockupTemplate).filter(MockupTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
        
    if req.canvas_json is not None:
        template.canvas_json = req.canvas_json
    if req.font_config is not None:
        template.font_config = req.font_config
    if req.background_color is not None:
        template.background_color = req.background_color
        
    db.commit()
    db.refresh(template)
    return template


@router.post("/templates/{template_id}/background")
async def upload_background(
    template_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload a new background image directly to the template."""
    template = db.query(MockupTemplate).filter(MockupTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    if file.content_type not in ("image/png", "image/jpeg", "image/jpg", "image/webp"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PNG, JPEG, and WebP images are accepted",
        )

    image_bytes = await file.read()
    ext = file.filename.rsplit(".", 1)[-1] if file.filename else "png"
    
    # Upload to R2
    key = f"mockups/{template.id}/bg_{uuid.uuid4().hex}.{ext}"
    upload_file_to_r2(key, image_bytes, file.content_type)
    
    template.original_image_url = key
    db.commit()
    
    return {"message": "Background updated", "image_url": key}


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


@router.delete("/templates/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db)):
    """Delete a specific mockup template."""
    template = db.query(MockupTemplate).filter(MockupTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(template)
    db.commit()
    return {"deleted": True}


@router.get("/templates/{template_id}/layers")
def get_template_layers(template_id: int, db: Session = Depends(get_db)):
    """Get presigned or public CDN URLs for template background."""
    template = db.query(MockupTemplate).filter(MockupTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    layers = {}
    if template.original_image_url:
        layers["original"] = (
            f"{settings.R2_PUBLIC_URL.rstrip('/')}/{template.original_image_url}"
            if settings.R2_PUBLIC_URL
            else get_presigned_url(template.original_image_url)
        )

    return {
        "template_id": template_id,
        "layers": layers,
    }
