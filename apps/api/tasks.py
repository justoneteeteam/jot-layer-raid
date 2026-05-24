"""Celery background tasks for bulk generation and WooCommerce store uploads."""
import io
import os
import json
import logging
import base64
import httpx
from datetime import datetime, timezone
from celery_app import celery_app
from database import SessionLocal
from models.bulk_job import BulkJob, BulkJobItem
from models.player import Player
from models.store import Store
from models.mockup_template import MockupTemplate
from models.team import Team
from services.image_engine import generate_jersey
from services.r2_storage import upload_file_to_r2, get_presigned_url
from config import settings

logger = logging.getLogger(__name__)


def upload_media_to_wordpress(store_url: str, api_key: str, api_secret: str, image_bytes: bytes, filename: str) -> str:
    """Upload jersey image bytes directly to WordPress Media Library and return the live source URL."""
    clean_url = store_url.strip().rstrip('/')
    auth_str = base64.b64encode(f"{api_key}:{api_secret}".encode("utf-8")).decode("utf-8")
    
    headers = {
        "Authorization": f"Basic {auth_str}",
        "Content-Disposition": f"attachment; filename={filename}",
        "Content-Type": "image/png"
    }
    
    logger.info(f"Uploading composited media file '{filename}' to WordPress at {clean_url}/wp-json/wp/v2/media...")
    
    # Send POST request to WordPress media endpoint
    response = httpx.post(
        f"{clean_url}/wp-json/wp/v2/media",
        content=image_bytes,
        headers=headers,
        timeout=45.0
    )
    
    if response.status_code == 201:
        data = response.json()
        logger.info(f"WordPress Media uploaded successfully! Source URL: {data.get('source_url')}")
        return data.get("source_url")
    else:
        raise Exception(f"WordPress media library upload failed (Status {response.status_code}): {response.text}")


def create_woocommerce_product(
    store_url: str,
    api_key: str,
    api_secret: str,
    title: str,
    price: str,
    description_html: str,
    image_url: str,
    sizes: list
) -> int:
    """Create a new product with size variations in WooCommerce and return the created product ID."""
    clean_url = store_url.strip().rstrip('/')
    auth_str = base64.b64encode(f"{api_key}:{api_secret}".encode("utf-8")).decode("utf-8")
    
    headers = {
        "Authorization": f"Basic {auth_str}",
        "Content-Type": "application/json"
    }

    # Map sizes to product attributes
    attributes = []
    if sizes:
        attributes = [{
            "name": "Size",
            "position": 0,
            "visible": True,
            "variation": True,
            "options": [s.replace("Men ", "").replace("Women ", "").replace("Youth ", "") for s in sizes]
        }]

    # Payload for variable product
    payload = {
        "name": title,
        "type": "variable" if sizes else "simple",
        "regular_price": price if not sizes else "",
        "description": description_html,
        "short_description": f"Premium tailored jersey mockup product.",
        "attributes": attributes,
        "images": [{"src": image_url}] if image_url else []
    }

    logger.info(f"Creating WooCommerce product '{title}'...")
    response = httpx.post(f"{clean_url}/wp-json/wc/v3/products", json=payload, headers=headers, timeout=30.0)
    
    if response.status_code != 201:
        raise Exception(f"WooCommerce product creation failed (Status {response.status_code}): {response.text}")
        
    product_data = response.json()
    product_id = product_data.get("id")
    logger.info(f"Product '{title}' created successfully! ID: {product_id}")

    # Create size variations if variable product
    if sizes and product_id:
        logger.info(f"Creating size variations for product {product_id}...")
        for size in sizes:
            clean_size = size.replace("Men ", "").replace("Women ", "").replace("Youth ", "")
            variation_payload = {
                "regular_price": price,
                "attributes": [{"name": "Size", "option": clean_size}],
                "image": {"src": image_url} if image_url else None
            }
            v_response = httpx.post(
                f"{clean_url}/wp-json/wc/v3/products/{product_id}/variations",
                json=variation_payload,
                headers=headers,
                timeout=20.0
            )
            if v_response.status_code != 201:
                logger.error(f"Failed to create variation '{clean_size}' (Status {v_response.status_code}): {v_response.text}")

    return product_id


@celery_app.task(bind=True, name="tasks.run_bulk_job")
def run_bulk_job(self, bulk_job_id: int):
    """
    Background Task: Orchestrates the image composite rendering, R2 storage uploading, 
    and WooCommerce store listing creation for a bulk job.
    """
    logger.info(f"🚀 Starting background Bulk Job #{bulk_job_id}")
    db = SessionLocal()
    
    try:
        # 1. Fetch Job and items
        job = db.query(BulkJob).filter(BulkJob.id == bulk_job_id).first()
        if not job:
            logger.error(f"Bulk job #{bulk_job_id} not found in database!")
            return
            
        job.status = "running"
        db.commit()

        items = db.query(BulkJobItem).filter(BulkJobItem.job_id == bulk_job_id).all()
        logger.info(f"Bulk Job #{bulk_job_id} contains {len(items)} items to process.")

        # 2. Get target store credentials
        store_target = job.store_targets[0] if job.store_targets else None
        if not store_target:
            raise Exception("No connected store targets configured for bulk job")
            
        store = db.query(Store).filter(Store.id == store_target.get("store_id")).first()
        if not store:
            raise Exception(f"Store connection ID {store_target.get('store_id')} not found")

        seo_template = job.seo_template or {}
        title_pattern = seo_template.get("title_pattern", "{player_name} - {team_name} {template_name} Jersey")
        description_pattern = seo_template.get("description_pattern", "")
        category = seo_template.get("category_pattern", "Jerseys")
        tags = seo_template.get("tags_pattern", "")
        sizes = seo_template.get("sizes", ["Men S", "Men M", "Men L"])

        # 3. Process each BulkJobItem
        for item in items:
            if item.status == "done":
                continue
                
            item.status = "generating"
            db.commit()
            
            try:
                # Fetch asset details
                player = db.query(Player).filter(Player.id == item.player_id).first()
                template = db.query(MockupTemplate).filter(MockupTemplate.id == item.mockup_template_id).first()
                team = db.query(Team).filter(Team.id == player.team_id).first() if player else None
                
                if not player or not template:
                    raise Exception("Player or mockup template reference is missing")
                
                team_name = team.name if team else "Team"
                
                # A. Generate Custom Jersey Image
                logger.info(f"Rendering image for {player.name} (#{player.number})...")
                jersey_bytes = generate_jersey(template.canvas_json, player.display_name, player.number, db)
                
                # B. Upload Custom Image to R2
                filename = f"{player.name.lower().replace(' ', '_')}_{item.gender.lower()}_{template.id}.png"
                r2_key = f"generated/{bulk_job_id}/{filename}"
                
                logger.info(f"Uploading generated PNG to Cloudflare R2 ({r2_key})...")
                upload_file_to_r2(r2_key, jersey_bytes, "image/png")
                
                # C. Save CDN URL
                cdn_url = ""
                if settings.R2_PUBLIC_URL:
                    cdn_url = f"{settings.R2_PUBLIC_URL.rstrip('/')}/{r2_key}"
                else:
                    cdn_url = get_presigned_url(r2_key)
                
                item.generated_image_url = cdn_url
                item.status = "uploading"
                db.commit()
                
                # D. Upload image to WordPress Media Library
                wp_image_url = upload_media_to_wordpress(
                    store.url, store.api_key, store.api_secret, jersey_bytes, filename
                )
                
                # E. Map Dynamic SEO Fields
                product_title = title_pattern.format(
                    player_name=player.name,
                    team_name=team_name,
                    template_name=template.name,
                    player_number=player.number
                )
                product_description = description_pattern.format(
                    player_name=player.name,
                    team_name=team_name,
                    template_name=template.name,
                    player_number=player.number
                )
                
                # Filter sizes matching the current item's gender/category
                item_sizes = [s for s in sizes if item.gender.lower() in s.lower()]
                if not item_sizes:
                    item_sizes = sizes  # fallback to all sizes
                
                # F. Create WooCommerce Listing
                logger.info(f"Uploading product listing to WooCommerce...")
                product_id = create_woocommerce_product(
                    store_url=store.url,
                    api_key=store.api_key,
                    api_secret=store.api_secret,
                    title=product_title,
                    price="29.99",
                    description_html=product_description,
                    image_url=wp_image_url,
                    sizes=item_sizes
                )
                
                item.product_title = product_title
                item.product_description = product_description
                item.product_category = category
                item.store_product_ids = {str(store.id): product_id}
                item.status = "done"
                
                job.completed_items += 1
                db.commit()
                logger.info(f"Item #{item.id} successfully generated and uploaded!")

            except Exception as item_err:
                logger.error(f"❌ Error processing item #{item.id}: {item_err}")
                item.status = "failed"
                item.error_message = str(item_err)
                job.failed_items += 1
                db.commit()

        # 4. Finalize Job Status
        if job.failed_items == job.total_items:
            job.status = "failed"
        else:
            job.status = "completed"
            
        job.completed_at = datetime.now(timezone.utc)
        db.commit()
        logger.info(f"✅ Finished background Bulk Job #{bulk_job_id} successfully!")

    except Exception as job_err:
        logger.error(f"❌ Critical Bulk Job failure: {job_err}")
        try:
            job = db.query(BulkJob).filter(BulkJob.id == bulk_job_id).first()
            if job:
                job.status = "failed"
                db.commit()
        except:
            pass
    finally:
        db.close()
