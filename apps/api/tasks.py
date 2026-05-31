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

@celery_app.task(bind=True, name="tasks.execute_flow_step")
def execute_flow_step(self, flow_run_id: int, step_index: int):
    """
    Background Task: Executes a single compiled workflow step for an automation run,
    handles wait-state calculations, suppressions filters, and personalized sends.
    """
    logger.info(f"⚙️ Executing Automation Flow Run #{flow_run_id} | Step Index: {step_index}")
    db = SessionLocal()
    try:
        from models.flow_run import FlowRun
        from models.automation_flow import AutomationFlow
        from models.contact import Contact
        from models.suppression import Suppression
        from models.email_template import EmailTemplate
        from models.email_sender_identity import EmailSenderIdentity
        from models.email_event import EmailEvent
        from services.email_engine import get_email_provider

        # 1. Fetch FlowRun
        flow_run = db.query(FlowRun).filter(FlowRun.id == flow_run_id).first()
        if not flow_run:
            logger.error(f"FlowRun #{flow_run_id} not found!")
            return

        if flow_run.status in ("completed", "cancelled"):
            logger.info(f"FlowRun #{flow_run_id} is already in state '{flow_run.status}'. Stopping.")
            return

        # 2. Fetch Flow and compiled schema
        flow = db.query(AutomationFlow).filter(AutomationFlow.id == flow_run.flow_id).first()
        if not flow or not flow.is_active:
            logger.warning(f"Flow ID {flow_run.flow_id} is inactive or missing. Terminating run.")
            flow_run.status = "cancelled"
            db.commit()
            return

        compiled_steps = json.loads(flow.compiled_schema_json).get("steps", [])
        if step_index >= len(compiled_steps):
            logger.info(f"FlowRun #{flow_run_id} has reached end of sequence. Marking as completed.")
            flow_run.status = "completed"
            db.commit()
            return

        step = compiled_steps[step_index]
        step_type = step.get("type")
        logger.info(f"Processing step node '{step.get('id')}' of type '{step_type}'")

        # 3. Fetch Subscriber Contact
        contact = db.query(Contact).filter(Contact.id == flow_run.contact_id).first()
        if not contact or contact.consent_status != "subscribed":
            logger.info(f"Contact {flow_run.contact_id} is missing or has opted out. Halting flow.")
            flow_run.status = "cancelled"
            db.commit()
            return

        # Check Suppression table
        is_suppressed = db.query(Suppression).filter(Suppression.store_id == flow_run.store_id, Suppression.email == contact.email).first()
        if is_suppressed:
            logger.info(f"Contact email {contact.email} is in suppression list. Halting flow.")
            flow_run.status = "cancelled"
            db.commit()
            return

        flow_run.current_node_id = step.get("id")

        if step_type == "wait":
            duration_hours = step.get("duration_hours", 1)
            # Wait calculations
            duration_seconds = int(duration_hours * 3600)
            
            # Update status to waiting
            flow_run.status = "waiting"
            flow_run.next_execution_at = datetime.fromtimestamp(datetime.now().timestamp() + duration_seconds, timezone.utc)
            db.commit()

            # Schedule the next step execution in Celery using countdown
            execute_flow_step.apply_async(
                args=[flow_run_id, step_index + 1],
                countdown=duration_seconds
            )
            logger.info(f"FlowRun #{flow_run_id} put in wait queue. Will resume in {duration_seconds}s.")
            return

        elif step_type == "suppression_check":
            flow_run.status = "active"
            db.commit()
            execute_flow_step.delay(flow_run_id, step_index + 1)
            return

        elif step_type == "send_email":
            template_id = step.get("template_id")
            template = db.query(EmailTemplate).filter(EmailTemplate.id == template_id).first()
            if not template:
                logger.error(f"Template ID {template_id} not found in step execution!")
                flow_run.status = "cancelled"
                db.commit()
                return

            # Resolve sender branding configs
            sender_config = db.query(EmailSenderIdentity).filter(EmailSenderIdentity.store_id == flow_run.store_id, EmailSenderIdentity.status == "active").first()
            if not sender_config:
                sender_config = db.query(EmailSenderIdentity).filter(EmailSenderIdentity.status == "active").first()

            # Mock sender if not found in db
            if not sender_config:
                sender_config = EmailSenderIdentity(
                    store_id=flow_run.store_id,
                    provider="cloudflare",
                    from_name="JOT Support",
                    from_email="support@justonetee.org",
                    domain="justonetee.org"
                )

            # Gather Provider Configuration
            provider_secrets = {}
            if sender_config.provider == "cloudflare":
                from routers.oms import load_email_settings
                settings = load_email_settings()
                provider_secrets = {
                    "cloudflare_account_id": settings.get("cloudflare_account_id"),
                    "cloudflare_api_token": settings.get("cloudflare_api_token")
                }
            elif sender_config.provider == "resend":
                provider_secrets = {"resend_api_key": sender_config.provider_config_ref}

            provider_instance = get_email_provider(sender_config.provider, provider_secrets)

            # Renders personalized placeholders
            personalized_body = template.body_html.replace("{customer_name}", contact.first_name or "Customer")
            
            # Format unsubscribe redirection URL
            unsubscribe_url = f"https://api.justonetee.org/api/marketing/unsubscribe?c_id={contact.id}"
            
            # Safe physical address footer injection
            personalized_body += f"""
            <hr style="border:0; border-top:1px solid #e2e8f0; margin-top:32px; margin-bottom:16px;" />
            <div style="font-size:11px; text-align:center; color:#94a3b8; line-height:1.5;">
                This automated email was sent to {contact.email}.<br/>
                JOT Layer Raid Corp • 123 Sports Jersey Ave, Provo, UT 84041<br/>
                <a href="{unsubscribe_url}" style="color:#f97316; text-decoration:underline;">One-Click Unsubscribe</a>
            </div>
            """

            # Serve tracking opens pixel
            personalized_body += f'<img src="https://api.justonetee.org/api/marketing/track/open/{template.id}/{contact.id}.gif" width="1" height="1" style="display:none;" />'

            # Outbound compliance headers
            headers = {
                "List-Unsubscribe": f"<{unsubscribe_url}>",
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
            }

            logger.info(f"Dispatched automated flow email via provider '{sender_config.provider}' to {contact.email}")
            success = provider_instance.send_email(
                from_name=sender_config.from_name,
                from_email=sender_config.from_email,
                recipient=contact.email,
                subject=template.subject.replace("{customer_name}", contact.first_name or "Customer"),
                html_body=personalized_body,
                reply_to=sender_config.reply_to_email,
                headers=headers
            )

            if success:
                # Save EmailEvent record
                evt = EmailEvent(
                    store_id=flow_run.store_id,
                    contact_id=contact.id,
                    flow_run_id=flow_run_id,
                    type="sent"
                )
                db.add(evt)
                db.commit()

            flow_run.status = "active"
            db.commit()
            execute_flow_step.delay(flow_run_id, step_index + 1)
            return

    except Exception as err:
        logger.error(f"❌ Error executing automation flow step #{flow_run_id}: {err}")
    finally:
        db.close()
