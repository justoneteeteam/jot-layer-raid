from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Form
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from models.font import Font
from services.r2_storage import upload_file_to_r2, get_presigned_url
import uuid

router = APIRouter(prefix="/api/fonts", tags=["Fonts"])


@router.get("")
def list_fonts(
    team_id: Optional[int] = None,
    jersey_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List all fonts, optionally filtered by team and jersey type."""
    query = db.query(Font)
    if team_id:
        query = query.filter(Font.team_id == team_id)
    if jersey_type and jersey_type != "All":
        query = query.filter(Font.jersey_type == jersey_type)
        
    fonts = query.all()
    return [
        {
            "id": f.id,
            "name": f.name,
            "file_url": (
                f"{settings.R2_PUBLIC_URL.rstrip('/')}/{f.file_url}"
                if settings.R2_PUBLIC_URL and f.file_url
                else get_presigned_url(f.file_url) if f.file_url else ""
            ),
            "preview_url": f.preview_url,
            "category": f.category,
            "team_id": f.team_id,
            "jersey_type": f.jersey_type,
            "team_name": f.team.name if f.team else None
        }
        for f in fonts
    ]


@router.post("/upload")
async def upload_fonts(
    files: list[UploadFile] = File(...),
    category: str = Form("NFL"),
    team_id: Optional[int] = Form(None),
    jersey_type: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """Upload one or more font files to R2 and save metadata."""
    results = []
    for file in files:
        data = await file.read()
        ext = file.filename.rsplit(".", 1)[-1] if file.filename else "ttf"
        key = f"fonts/{uuid.uuid4().hex}.{ext}"
        content_type = "font/ttf"
        if ext == "otf":
            content_type = "font/otf"
        elif ext in ("woff", "woff2"):
            content_type = f"font/{ext}"

        upload_file_to_r2(key, data, content_type=content_type)

        name = file.filename.rsplit(".", 1)[0] if file.filename else "Unnamed"
        font = Font(
            name=name, 
            file_url=key, 
            category=category,
            team_id=team_id if team_id and team_id > 0 else None,
            jersey_type=jersey_type if jersey_type else None
        )
        db.add(font)
        db.commit()
        db.refresh(font)
        results.append({
            "id": font.id, 
            "name": font.name, 
            "file_url": key,
            "team_id": font.team_id,
            "jersey_type": font.jersey_type
        })

    return {"uploaded": len(results), "fonts": results}


@router.delete("/{font_id}")
def delete_font(font_id: int, db: Session = Depends(get_db)):
    """Delete a font by ID."""
    font = db.query(Font).filter(Font.id == font_id).first()
    if not font:
        raise HTTPException(status_code=404, detail="Font not found")
    db.delete(font)
    db.commit()
    return {"deleted": font_id}
