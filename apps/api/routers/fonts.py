from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.font import Font
from services.r2_storage import upload_file_to_r2
import uuid

router = APIRouter(prefix="/api/fonts", tags=["Fonts"])


@router.get("")
def list_fonts(db: Session = Depends(get_db)):
    """List all fonts."""
    fonts = db.query(Font).all()
    return [
        {
            "id": f.id,
            "name": f.name,
            "file_url": f.file_url,
            "preview_url": f.preview_url,
            "category": f.category,
        }
        for f in fonts
    ]


@router.post("/upload")
async def upload_fonts(
    files: list[UploadFile] = File(...),
    category: str = "NFL",
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
        font = Font(name=name, file_url=key, category=category)
        db.add(font)
        db.commit()
        db.refresh(font)
        results.append({"id": font.id, "name": font.name, "file_url": key})

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
