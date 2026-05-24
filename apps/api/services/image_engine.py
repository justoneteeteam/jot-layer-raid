"""Image Composition Engine: Composits custom player name & number text onto blank jersey templates using Pillow."""
import io
import json
import logging
import os
import httpx
from PIL import Image, ImageDraw, ImageFont
from sqlalchemy.orm import Session
from database import SessionLocal
from models.font import Font

logger = logging.getLogger(__name__)


def download_image(url_or_path: str) -> Image.Image:
    """Download an image from a URL or load from a local filesystem path."""
    if url_or_path.startswith("http://") or url_or_path.startswith("https://"):
        logger.info(f"Downloading template background from: {url_or_path}")
        # Add a custom user-agent to bypass potential bot protection
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        response = httpx.get(url_or_path, headers=headers, timeout=30.0)
        response.raise_for_status()
        return Image.open(io.BytesIO(response.content))
    else:
        # Resolve local path relative to api or project root
        if os.path.isabs(url_or_path):
            return Image.open(url_or_path)
            
        api_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        root_dir = os.path.dirname(api_dir)
        for base in [api_dir, root_dir]:
            p = os.path.join(base, url_or_path)
            if os.path.exists(p):
                return Image.open(p)
                
        raise FileNotFoundError(f"Could not locate background template at: {url_or_path}")


def get_font_path(font_name: str, db: Session) -> str:
    """Retrieve local file path of a custom font. Downloads from R2 if necessary."""
    font = db.query(Font).filter(Font.name == font_name).first()
    if font and font.file_url:
        url_or_path = font.file_url
        if url_or_path.startswith("http://") or url_or_path.startswith("https://"):
            cache_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "temp_fonts")
            os.makedirs(cache_dir, exist_ok=True)
            local_path = os.path.join(cache_dir, f"{font_name}.ttf")
            
            if not os.path.exists(local_path):
                logger.info(f"Downloading custom font '{font_name}' from: {url_or_path}")
                headers = {"User-Agent": "Mozilla/5.0"}
                response = httpx.get(url_or_path, headers=headers, timeout=30.0)
                response.raise_for_status()
                with open(local_path, "wb") as f:
                    f.write(response.content)
            return local_path
        else:
            api_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            root_dir = os.path.dirname(api_dir)
            for base in [api_dir, root_dir]:
                p = os.path.join(base, url_or_path)
                if os.path.exists(p):
                    return p
                    
    # Fallback to local default font (Arial block or similar)
    logger.warning(f"Font '{font_name}' not found, falling back to default Arial")
    return "Arial"


def generate_jersey(
    canvas_json: dict,
    player_name: str,
    player_number: int,
    db: Session
) -> bytes:
    """
    Renders custom player name and number text directly over a blank jersey background.
    Returns composite image as PNG bytes.
    """
    objects = canvas_json.get("objects", [])
    bg_obj = None
    text_objects = []

    # Separate background image from overlay texts
    for obj in objects:
        layer_label = obj.get("_layerLabel", "")
        obj_type = obj.get("type", "")
        
        if obj.get("_isJerseyBackground") or layer_label == "Jersey Background" or obj_type == "image":
            # Prefer specifically marked background objects
            if obj.get("_isJerseyBackground") or layer_label == "Jersey Background" or not bg_obj:
                bg_obj = obj
        elif obj_type in ("textbox", "text"):
            text_objects.append(obj)

    # Determine template background image URL
    bg_url = None
    if bg_obj and bg_obj.get("src"):
        bg_url = bg_obj.get("src")
        # Translate local download proxies back to original R2 URLs to avoid local network loops
        if "/api/mockups/templates/" in bg_url and "/background/download" in bg_url:
            try:
                parts = bg_url.split("/")
                template_id = int(parts[parts.index("templates") + 1])
                from models.mockup_template import MockupTemplate
                tpl = db.query(MockupTemplate).filter(MockupTemplate.id == template_id).first()
                if tpl and tpl.original_image_url:
                    bg_url = tpl.original_image_url
            except Exception as e:
                logger.error(f"Error resolving proxied background template URL: {e}")
    
    # Fallback if no template URL exists
    if not bg_url:
        bg_url = "apps/api/test_img.png"

    # Load and scale base jersey
    base_img = download_image(bg_url)
    if base_img.mode != "RGBA":
        base_img = base_img.convert("RGBA")

    width, height = base_img.size
    
    # Coordinate scaling coefficients (Fabric design size is 800 x 1000)
    scale_x = width / 800.0
    scale_y = height / 1000.0
    scale_avg = (scale_x + scale_y) / 2.0

    # Overlay layer
    overlay = Image.new("RGBA", base_img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    # Render each text object onto the overlay
    for obj in text_objects:
        layer_label = obj.get("_layerLabel", "")
        
        # Substitute placeholders with actual database name and number
        if layer_label == "Player Name" or "name" in layer_label.lower():
            text_content = player_name.upper()
        elif layer_label == "Player Number" or "number" in layer_label.lower():
            text_content = str(player_number)
        else:
            text_content = obj.get("text", "")

        # Extract canvas dimensions and typography settings
        font_family = obj.get("fontFamily", "Arial")
        font_size = int(obj.get("fontSize", 60) * scale_avg)
        fill_color = obj.get("fill", "#FFFFFF")
        stroke_color = obj.get("stroke", "#000000")
        stroke_width = int(obj.get("strokeWidth", 0) * scale_avg)
        
        left = obj.get("left", 400) * scale_x
        top = obj.get("top", 500) * scale_y
        angle = obj.get("angle", 0)

        # Resolve font path
        font_path = get_font_path(font_family, db)
        try:
            font = ImageFont.truetype(font_path, font_size)
        except Exception as e:
            logger.error(f"Error loading TTF font '{font_family}': {e}. Falling back to default.")
            font = ImageFont.load_default()

        # Render text (handles rotation via temp canvas rotate-and-paste)
        if angle != 0:
            bbox = draw.textbbox((0, 0), text_content, font=font, anchor="mm")
            txt_w = (bbox[2] - bbox[0]) + (stroke_width * 2) + 40
            txt_h = (bbox[3] - bbox[1]) + (stroke_width * 2) + 40
            
            txt_img = Image.new("RGBA", (txt_w, txt_h), (0, 0, 0, 0))
            txt_draw = ImageDraw.Draw(txt_img)
            
            txt_draw.text(
                (txt_w // 2, txt_h // 2),
                text_content,
                font=font,
                fill=fill_color,
                stroke_width=stroke_width,
                stroke_fill=stroke_color,
                anchor="mm"
            )
            
            rotated_txt = txt_img.rotate(-angle, expand=1, resample=Image.Resample.BICUBIC)
            paste_left = int(left - (rotated_txt.width // 2))
            paste_top = int(top - (rotated_txt.height // 2))
            overlay.alpha_composite(rotated_txt, (paste_left, paste_top))
        else:
            draw.text(
                (left, top),
                text_content,
                font=font,
                fill=fill_color,
                stroke_width=stroke_width,
                stroke_fill=stroke_color,
                anchor="mm"
            )

    # Merge final composited PNG
    final_img = Image.alpha_composite(base_img, overlay)
    out_bytes = io.BytesIO()
    final_img.save(out_bytes, format="PNG")
    return out_bytes.getvalue()
