"""
Qwen Hybrid Jersey Text Separation Service.

Pipeline: Detect text (VL) → Generate mask (Pillow) → Inpaint clean jersey (Image Edit) → Extract layers.
Cost: ~$0.033/jersey ($0.003 VL detection + $0.030 image edit).
"""

import io
import json
import re
import time
import base64
import logging
from dataclasses import dataclass, field
from typing import Optional

import httpx
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import dashscope
from dashscope import MultiModalConversation

from config import settings
from services.r2_storage import upload_file_to_r2, get_presigned_url

logger = logging.getLogger(__name__)

# Configure DashScope SDK for Singapore region
dashscope.base_http_api_url = settings.DASHSCOPE_BASE_URL


# ── Data Structures ──────────────────────────────────────────────────────────

@dataclass
class TextRegion:
    """A detected text region on the jersey."""
    label: str          # "name" or "number"
    bbox: tuple         # (x1, y1, x2, y2) in pixels
    confidence: float = 1.0
    text_content: str = ""


@dataclass
class SeparationResult:
    """Result of the full separation pipeline."""
    blank_jersey_key: str = ""
    name_layer_key: str = ""
    number_layer_key: str = ""
    text_positions: dict = field(default_factory=dict)
    detected_regions: list = field(default_factory=list)
    cost_cents: float = 0.0
    error: Optional[str] = None


# ── Step 1: Detect Text Regions via Qwen VL ──────────────────────────────────

def detect_text_regions(image_bytes: bytes, image_width: int, image_height: int) -> list[TextRegion]:
    """
    Use Qwen VL to detect text (name and number) regions on a jersey image.
    Returns a list of TextRegion with pixel-coordinate bounding boxes.
    """
    # Encode image as base64 data URI for the VL model
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    data_uri = f"data:image/png;base64,{b64}"

    detection_prompt = f"""You are analyzing a sports jersey image that is {image_width}x{image_height} pixels.

Detect ALL text elements on this jersey. There should be:
1. A player NAME (usually on the upper back)
2. A player NUMBER (usually large, center of jersey)

For each text element found, return its bounding box in pixel coordinates.

Return ONLY a JSON array like this, nothing else:
[
  {{"label": "name", "bbox": [x1, y1, x2, y2], "text": "MAHOMES"}},
  {{"label": "number", "bbox": [x1, y1, x2, y2], "text": "15"}}
]

Where x1,y1 is the top-left corner and x2,y2 is the bottom-right corner, in pixel coordinates.
If you cannot find a name or number, omit that entry. Return at least the elements you can detect.
Return ONLY valid JSON, no markdown or explanation."""

    messages = [{
        "role": "user",
        "content": [
            {"image": data_uri},
            {"text": detection_prompt}
        ]
    }]

    try:
        response = MultiModalConversation.call(
            api_key=settings.QWEN_API_KEY,
            model=settings.QWEN_VL_MODEL,
            messages=messages,
            result_format="message",
        )

        if response.status_code != 200:
            logger.error(f"VL detection failed: {response.code} - {response.message}")
            return []

        # Extract content from response
        content = response.output.choices[0].message.content
        if isinstance(content, list):
            # Multimodal response returns list of content blocks
            text_content = ""
            for block in content:
                if isinstance(block, dict) and "text" in block:
                    text_content += block["text"]
                elif isinstance(block, str):
                    text_content += block
        else:
            text_content = str(content)

        logger.info(f"VL raw response: {text_content[:500]}")

        # Parse JSON from the response (handle markdown code blocks)
        json_match = re.search(r'\[.*\]', text_content, re.DOTALL)
        if not json_match:
            logger.warning("No JSON array found in VL response")
            return []

        detected = json.loads(json_match.group())
        regions = []
        for item in detected:
            bbox = item.get("bbox", [])
            if len(bbox) == 4:
                # Clamp to image bounds
                x1 = max(0, min(int(bbox[0]), image_width))
                y1 = max(0, min(int(bbox[1]), image_height))
                x2 = max(0, min(int(bbox[2]), image_width))
                y2 = max(0, min(int(bbox[3]), image_height))

                if x2 > x1 and y2 > y1:
                    regions.append(TextRegion(
                        label=item.get("label", "unknown"),
                        bbox=(x1, y1, x2, y2),
                        text_content=item.get("text", ""),
                    ))

        logger.info(f"Detected {len(regions)} text regions: {[(r.label, r.bbox) for r in regions]}")
        return regions

    except Exception as e:
        logger.exception(f"VL detection error: {e}")
        return []


# ── Step 2: Generate Binary Mask ─────────────────────────────────────────────

def generate_mask(image_size: tuple[int, int], regions: list[TextRegion], padding: int = 15) -> bytes:
    """
    Create a binary mask image from detected text regions.
    White (255) = text area to remove, Black (0) = keep.
    Applies slight feathering for cleaner inpainting seams.
    """
    width, height = image_size
    mask = Image.new("L", (width, height), 0)  # All black (keep)
    draw = ImageDraw.Draw(mask)

    for region in regions:
        x1, y1, x2, y2 = region.bbox
        # Add padding around detected text for better inpainting
        padded = (
            max(0, x1 - padding),
            max(0, y1 - padding),
            min(width, x2 + padding),
            min(height, y2 + padding),
        )
        draw.rectangle(padded, fill=255)  # White = inpaint area

    # Apply slight Gaussian blur for feathered edges
    mask = mask.filter(ImageFilter.GaussianBlur(radius=3))

    # Re-threshold to keep clean binary mask with soft edges
    # Values above 128 become 255, below become 0
    mask_array = np.array(mask)
    mask_array = np.where(mask_array > 64, 255, 0).astype(np.uint8)
    mask = Image.fromarray(mask_array)

    buf = io.BytesIO()
    mask.save(buf, format="PNG")
    return buf.getvalue()


# ── Step 3: Inpaint Clean Jersey ─────────────────────────────────────────────

def inpaint_clean_jersey(image_bytes: bytes) -> Optional[str]:
    """
    Use Qwen Image Edit to remove text from the jersey via inpainting.
    Returns the URL of the clean (text-removed) jersey image.
    
    Uses the DashScope MultiModalConversation SDK.
    """
    import tempfile
    import os
    from dashscope import MultiModalConversation

    prompt = (
        "Remove all text, names, numbers, and lettering from this jersey. "
        "Reconstruct the original jersey fabric pattern, stitching, and texture cleanly. "
        "Keep the jersey color, design elements, stripes, and logos intact. "
        "The result should look like a blank jersey with no text whatsoever."
    )

    # Save bytes to a temp file so the SDK can upload it
    with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as temp_file:
        temp_file.write(image_bytes)
        temp_file_path = temp_file.name

    try:
        messages = [
            {
                "role": "user",
                "content": [
                    {"image": f"file://{temp_file_path}"},
                    {"text": prompt}
                ]
            }
        ]

        logger.info("Submitting inpaint request via DashScope SDK...")
        response = MultiModalConversation.call(
            api_key=settings.QWEN_API_KEY,
            model=settings.QWEN_IMAGE_EDIT_MODEL,
            messages=messages
        )

        if response.status_code == 200:
            content = response.output.choices[0].message.content
            # Extract the image URL from the multimodal response
            for item in content:
                if isinstance(item, dict) and "image" in item:
                    logger.info("Inpaint succeeded.")
                    return item["image"]
            logger.error(f"No image found in response: {content}")
            return None
        else:
            logger.error(f"Inpaint failed: {response.code} - {response.message}")
            return None

    except Exception as e:
        logger.exception(f"Inpaint error: {e}")
        return None
    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)


# ── Step 4: Extract Text Layers ──────────────────────────────────────────────

def extract_text_layers(
    original_bytes: bytes,
    regions: list[TextRegion],
    padding: int = 15,
) -> dict[str, bytes]:
    """
    Extract text pixels from the original image as RGBA layers.
    Each layer has the text pixels visible and everything else transparent.
    
    Returns dict: {"name": png_bytes, "number": png_bytes}
    """
    original = Image.open(io.BytesIO(original_bytes)).convert("RGBA")
    width, height = original.size
    original_array = np.array(original)

    layers = {}
    for region in regions:
        x1, y1, x2, y2 = region.bbox
        # Add padding
        x1 = max(0, x1 - padding)
        y1 = max(0, y1 - padding)
        x2 = min(width, x2 + padding)
        y2 = min(height, y2 + padding)

        # Create empty RGBA layer
        layer = np.zeros_like(original_array)

        # Copy the original pixels in the text region
        layer[y1:y2, x1:x2, :3] = original_array[y1:y2, x1:x2, :3]
        layer[y1:y2, x1:x2, 3] = 255  # Fully opaque in text region

        layer_img = Image.fromarray(layer)
        buf = io.BytesIO()
        layer_img.save(buf, format="PNG")
        layers[region.label] = buf.getvalue()

    return layers


# ── Main Pipeline Orchestrator ───────────────────────────────────────────────

def separate_jersey(
    image_bytes: bytes,
    r2_prefix: str = "separations",
    job_id: Optional[str] = None,
    progress_callback=None,
) -> SeparationResult:
    """
    Full hybrid separation pipeline.
    
    1. Detect text regions with Qwen VL
    2. Generate binary mask from detections
    3. Inpaint clean jersey with Qwen Image Edit
    4. Extract text layers using mask
    5. Upload all results to R2
    
    Args:
        image_bytes: Raw jersey image bytes (PNG/JPEG)
        r2_prefix: R2 storage prefix
        job_id: Unique job identifier for file naming
        progress_callback: Optional fn(step, message) for progress updates
    """
    result = SeparationResult()
    job_id = job_id or str(int(time.time()))

    def update_progress(step: str, msg: str):
        logger.info(f"[{job_id}] {step}: {msg}")
        if progress_callback:
            progress_callback(step, msg)

    try:
        # Load image to get dimensions
        img = Image.open(io.BytesIO(image_bytes))
        width, height = img.size
        update_progress("init", f"Image loaded: {width}x{height}")

        # Ensure PNG for processing
        if img.format != "PNG":
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            image_bytes = buf.getvalue()

        # ── Step 1: Detect text regions
        update_progress("detecting_text", "Detecting text regions with Qwen VL...")
        regions = detect_text_regions(image_bytes, width, height)

        if not regions:
            # Fallback: use default positions if VL detection fails
            update_progress("detecting_text", "VL detection returned no regions, using defaults")
            regions = [
                TextRegion(label="name", bbox=(
                    int(width * 0.2), int(height * 0.05),
                    int(width * 0.8), int(height * 0.18)
                )),
                TextRegion(label="number", bbox=(
                    int(width * 0.25), int(height * 0.20),
                    int(width * 0.75), int(height * 0.55)
                )),
            ]

        result.detected_regions = [
            {"label": r.label, "bbox": list(r.bbox), "text": r.text_content}
            for r in regions
        ]
        result.cost_cents += 0.3  # ~$0.003 for VL call

        # ── Step 2: Generate mask
        update_progress("generating_mask", "Generating binary mask from detections...")
        mask_bytes = generate_mask((width, height), regions)

        # Upload original and mask to R2 so DashScope can access them
        original_key = f"{r2_prefix}/{job_id}/original.png"
        mask_key = f"{r2_prefix}/{job_id}/mask.png"

        upload_file_to_r2(original_key, image_bytes, "image/png")
        upload_file_to_r2(mask_key, mask_bytes, "image/png")

        original_url = get_presigned_url(original_key, expiration=3600)
        mask_url = get_presigned_url(mask_key, expiration=3600)

        update_progress("generating_mask", "Mask generated and uploaded")

        # ── Step 3: Inpaint clean jersey
        update_progress("inpainting", "Removing text via Qwen Image Edit (this takes ~30s)...")
        clean_url = inpaint_clean_jersey(image_bytes)

        if clean_url:
            # Download the inpainted image and upload to R2
            with httpx.Client(timeout=30) as client:
                clean_resp = client.get(clean_url)
                clean_bytes = clean_resp.content

            blank_key = f"{r2_prefix}/{job_id}/blank_jersey.png"
            upload_file_to_r2(blank_key, clean_bytes, "image/png")
            result.blank_jersey_key = blank_key
            update_progress("inpainting", "Clean jersey generated successfully")
        else:
            update_progress("inpainting", "Inpainting failed — using original as blank")
            result.blank_jersey_key = original_key

        result.cost_cents += 3.0  # $0.03 for image edit

        # ── Step 4: Extract text layers
        update_progress("extracting_layers", "Extracting text layers...")
        text_layers = extract_text_layers(image_bytes, regions)

        for label, layer_bytes in text_layers.items():
            layer_key = f"{r2_prefix}/{job_id}/{label}_layer.png"
            upload_file_to_r2(layer_key, layer_bytes, "image/png")

            if label == "name":
                result.name_layer_key = layer_key
            elif label == "number":
                result.number_layer_key = layer_key

        # Calculate text positions as percentages for Fabric.js
        result.text_positions = {}
        for region in regions:
            x1, y1, x2, y2 = region.bbox
            center_x = ((x1 + x2) / 2) / width
            center_y = ((y1 + y2) / 2) / height
            result.text_positions[region.label] = {
                "x": round(center_x, 3),
                "y": round(center_y, 3),
                "width": round((x2 - x1) / width, 3),
                "height": round((y2 - y1) / height, 3),
            }

        update_progress("done", "Separation complete!")
        return result

    except Exception as e:
        logger.exception(f"Separation pipeline failed: {e}")
        result.error = str(e)
        return result
