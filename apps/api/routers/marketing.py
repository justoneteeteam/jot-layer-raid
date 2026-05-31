import os
import json
import logging
import base64
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from database import get_db

from models.email_sender_identity import EmailSenderIdentity
from models.contact import Contact
from models.suppression import Suppression
from models.email_template import EmailTemplate
from models.marketing_campaign import MarketingCampaign
from models.email_event import EmailEvent
from models.automation_flow import AutomationFlow

from services.email_engine import get_email_provider
from services.tracking import verify_tracking_link, generate_secure_tracking_link

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/marketing", tags=["marketing"])

# ── 1. SENDER IDENTITY CONFIGS ──
@router.get("/senders", response_model=List[dict])
def get_senders(db: Session = Depends(get_db)):
    senders = db.query(EmailSenderIdentity).all()
    return [{
        "id": s.id, "store_id": s.store_id, "provider": s.provider,
        "from_name": s.from_name, "from_email": s.from_email,
        "reply_to_email": s.reply_to_email, "domain": s.domain,
        "status": s.status, "created_at": s.created_at.isoformat()
    } for s in senders]

@router.post("/senders")
def create_or_update_sender(payload: dict, db: Session = Depends(get_db)):
    sender_id = payload.get("id")
    store_id = payload.get("store_id")
    provider = payload.get("provider")
    from_name = payload.get("from_name")
    from_email = payload.get("from_email")
    reply_to_email = payload.get("reply_to_email")
    domain = payload.get("domain")
    provider_config_ref = payload.get("provider_config_ref") # API Key reference
    
    if not store_id or not provider or not from_email or not domain:
        raise HTTPException(status_code=400, detail="Missing required sender identity parameters.")

    if sender_id:
        sender = db.query(EmailSenderIdentity).filter(EmailSenderIdentity.id == sender_id).first()
        if not sender:
            raise HTTPException(status_code=404, detail="Sender identity not found.")
    else:
        sender = EmailSenderIdentity()
        db.add(sender)

    sender.store_id = store_id
    sender.provider = provider
    sender.from_name = from_name
    sender.from_email = from_email
    sender.reply_to_email = reply_to_email
    sender.domain = domain
    sender.status = "active" # verified/active by default for MVP
    if provider_config_ref:
        sender.provider_config_ref = provider_config_ref

    db.commit()
    return {"status": "ok", "message": "Sender identity configuration saved."}

@router.delete("/senders/{sender_id}")
def delete_sender(sender_id: int, db: Session = Depends(get_db)):
    sender = db.query(EmailSenderIdentity).filter(EmailSenderIdentity.id == sender_id).first()
    if not sender:
        raise HTTPException(status_code=404, detail="Sender not found.")
    db.delete(sender)
    db.commit()
    return {"status": "ok", "message": "Sender configuration removed."}


# ── 2. TEMPLATE CRUD ──
@router.get("/templates")
def get_templates(db: Session = Depends(get_db)):
    templates = db.query(EmailTemplate).all()
    return templates

@router.post("/templates")
def create_or_update_template(payload: dict, db: Session = Depends(get_db)):
    template_id = payload.get("id")
    store_id = payload.get("store_id", "General")
    name = payload.get("name")
    subject = payload.get("subject")
    body_html = payload.get("body_html")

    if not name or not subject or not body_html:
        raise HTTPException(status_code=400, detail="Name, subject, and body_html are required.")

    if template_id:
        template = db.query(EmailTemplate).filter(EmailTemplate.id == template_id).first()
        if not template:
            raise HTTPException(status_code=404, detail="Template not found.")
    else:
        template = EmailTemplate()
        db.add(template)

    template.store_id = store_id
    template.name = name
    template.subject = subject
    template.body_html = body_html
    db.commit()
    return {"status": "ok", "message": "Template saved successfully.", "id": template.id}

@router.delete("/templates/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db)):
    template = db.query(EmailTemplate).filter(EmailTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found.")
    db.delete(template)
    db.commit()
    return {"status": "ok", "message": "Template successfully removed."}


# ── 3. CONTACT & SUPPRESSION SYNC ──
@router.get("/contacts")
def get_contacts(db: Session = Depends(get_db)):
    return db.query(Contact).all()

@router.post("/contacts/sync")
def batch_sync_contacts(payload: dict, db: Session = Depends(get_db)):
    """CSV Ingestion Sync Endpoint with Duplicate Checking & Consent Auditing."""
    store_id = payload.get("store_id", "WaiRaiders Store")
    raw_contacts = payload.get("contacts", []) # list of dicts: email, first_name, last_name, consent_source
    
    if not raw_contacts:
        return {"status": "skipped", "message": "No contacts provided for sync."}

    created_count = 0
    updated_count = 0

    for item in raw_contacts:
        email = item.get("email", "").strip().lower()
        if not email:
            continue
        
        # Deduplication Guard
        existing = db.query(Contact).filter(Contact.store_id == store_id, Contact.email == email).first()
        if existing:
            existing.first_name = item.get("first_name", existing.first_name)
            existing.last_name = item.get("last_name", existing.last_name)
            existing.consent_source = item.get("consent_source", existing.consent_source) or "csv_import"
            updated_count += 1
        else:
            new_contact = Contact(
                store_id=store_id,
                email=email,
                first_name=item.get("first_name"),
                last_name=item.get("last_name"),
                consent_status="subscribed",
                consent_source=item.get("consent_source", "csv_import")
            )
            db.add(new_contact)
            created_count += 1

    db.commit()
    return {
        "status": "success",
        "created": created_count,
        "updated": updated_count,
        "message": f"Successfully processed {created_count + updated_count} contact records."
    }

@router.get("/suppressions")
def get_suppressions(db: Session = Depends(get_db)):
    return db.query(Suppression).all()

# ── 3.5. AUTOMATION FLOWS CRUD ──
@router.get("/flows")
def get_flows(db: Session = Depends(get_db)):
    return db.query(AutomationFlow).all()

@router.post("/flows")
def create_or_update_flow(payload: dict, db: Session = Depends(get_db)):
    flow_id = payload.get("id")
    store_id = payload.get("store_id", "WaiRaiders Store")
    name = payload.get("name")
    trigger_event = payload.get("trigger_event")
    steps = payload.get("steps", []) # List of steps e.g. delay, suppression, send

    if not name or not trigger_event:
        raise HTTPException(status_code=400, detail="Name and trigger_event are required.")

    # Validate steps structures
    for step in steps:
        stype = step.get("type")
        if stype not in ("wait", "suppression_check", "send_email"):
            raise HTTPException(status_code=400, detail=f"Invalid flow step type '{stype}'.")

    # Compile schema structure
    compiled_schema = {
        "trigger": trigger_event,
        "steps": steps
    }

    if flow_id:
        flow = db.query(AutomationFlow).filter(AutomationFlow.id == flow_id).first()
        if not flow:
            raise HTTPException(status_code=404, detail="Flow not found.")
        flow.version += 1
    else:
        flow = AutomationFlow()
        db.add(flow)
        flow.version = 1

    flow.store_id = store_id
    flow.name = name
    flow.trigger_event = trigger_event
    flow.visual_schema_json = json.dumps({"steps": steps})
    flow.compiled_schema_json = json.dumps(compiled_schema)
    flow.is_active = payload.get("is_active", True)

    db.commit()
    db.refresh(flow)
    return {"status": "success", "message": "Automation flow saved successfully.", "flow": flow}

@router.post("/flows/{flow_id}/toggle")
def toggle_flow_state(flow_id: int, db: Session = Depends(get_db)):
    flow = db.query(AutomationFlow).filter(AutomationFlow.id == flow_id).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found.")
    flow.is_active = not flow.is_active
    db.commit()
    return {"status": "success", "is_active": flow.is_active, "message": f"Flow status updated to {'enabled' if flow.is_active else 'disabled'}."}

@router.delete("/flows/{flow_id}")
def delete_flow(flow_id: int, db: Session = Depends(get_db)):
    flow = db.query(AutomationFlow).filter(AutomationFlow.id == flow_id).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found.")
    db.delete(flow)
    db.commit()
    return {"status": "success", "message": "Automation flow successfully deleted."}


# ── 4. CAMPAIGNS & DISPATCH ENGINE ──
@router.get("/campaigns")
def get_campaigns(db: Session = Depends(get_db)):
    return db.query(MarketingCampaign).order_by(MarketingCampaign.created_at.desc()).all()

@router.post("/campaigns")
def create_campaign(payload: dict, db: Session = Depends(get_db)):
    name = payload.get("name")
    subject = payload.get("subject")
    body_html = payload.get("body_html")
    store_id = payload.get("store_id", "WaiRaiders Store")

    if not name or not subject or not body_html:
        raise HTTPException(status_code=400, detail="Missing required parameters.")

    campaign = MarketingCampaign(
        name=name,
        subject=subject,
        body_html=body_html,
        status="draft",
        sent_count=0
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return {"status": "success", "campaign": campaign}

@router.post("/campaigns/{campaign_id}/send")
def trigger_campaign_send(campaign_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Campaign Dispatch with Suppression Lists Audit Checks."""
    campaign = db.query(MarketingCampaign).filter(MarketingCampaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    
    if campaign.status != "draft":
        raise HTTPException(status_code=400, detail="Campaign has already been triggered.")

    # 1. Resolve matching Outbound Sender config
    # Fetch first active sender config for this store, otherwise fallback
    sender_config = db.query(EmailSenderIdentity).filter(EmailSenderIdentity.status == "active").first()
    if not sender_config:
        # Fallback Mock config
        sender_config = EmailSenderIdentity(
            store_id="WaiRaiders Store",
            provider="cloudflare",
            from_name="WaiRaiders",
            from_email="support@wairaiders.com",
            domain="wairaiders.com"
        )
    
    # Resolves provider adapter credentials securely
    provider_secrets = {}
    if sender_config.provider == "cloudflare":
        # Load from CRM settings configurations
        from routers.oms import load_email_settings
        crm_sets = load_email_settings()
        provider_secrets = {
            "cloudflare_account_id": crm_sets.get("cloudflare_account_id"),
            "cloudflare_api_token": crm_sets.get("cloudflare_api_token")
        }

    provider_instance = get_email_provider(sender_config.provider, provider_secrets)

    # 2. Gather eligible recipients (filter out unsubscribed and suppressed contacts)
    all_contacts = db.query(Contact).filter(Contact.consent_status == "subscribed").all()
    suppression_list = {s.email.lower() for s in db.query(Suppression).all()}

    eligible_contacts = [c for c in all_contacts if c.email.lower() not in suppression_list]

    if not eligible_contacts:
        campaign.status = "completed"
        db.commit()
        return {"status": "skipped", "message": "No eligible subscribers found. Delivery skipped."}

    # Queue actual execution to celery/background tasks
    def dispatch_loop():
        db_job = Session()
        try:
            local_campaign = db_job.query(MarketingCampaign).filter(MarketingCampaign.id == campaign_id).first()
            sent_count = 0
            
            for contact in eligible_contacts:
                # Compile dynamic placeholders
                personalized_body = local_campaign.body_html.replace("{customer_name}", contact.first_name or "Subscriber")
                
                # Append required footer compliant physical mailing address & unsubscribe options
                personalized_body += f"""
                <hr style="border:0; border-top:1px solid #e2e8f0; margin-top:32px; margin-bottom:16px;" />
                <div style="font-size:11px; text-align:center; color:#94a3b8; line-height:1.5;">
                    This marketing message was sent to {contact.email}.<br/>
                    JOT Layer Raid Corp • 123 Sports Jersey Ave, Provo, UT 84041<br/>
                    <a href="https://api.justonetee.org/api/marketing/unsubscribe?c_id={contact.id}" style="color:#f97316; text-decoration:underline;">One-Click Unsubscribe</a>
                </div>
                """
                
                # Inject 1x1 open tracking pixel
                personalized_body += f'<img src="https://api.justonetee.org/api/marketing/track/open/{campaign_id}/{contact.id}.gif" width="1" height="1" style="display:none;" />'
                
                # Outbound headers including compliant RFC List-Unsubscribe
                unsubscribe_url = f"https://api.justonetee.org/api/marketing/unsubscribe?c_id={contact.id}"
                headers = {
                    "List-Unsubscribe": f"<{unsubscribe_url}>",
                    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
                }
                
                success = provider_instance.send_email(
                    from_name=sender_config.from_name,
                    from_email=sender_config.from_email,
                    recipient=contact.email,
                    subject=local_campaign.subject,
                    html_body=personalized_body,
                    reply_to=sender_config.reply_to_email,
                    headers=headers
                )
                
                if success:
                    sent_count += 1
                    # Save EmailEvent Sent record
                    evt = EmailEvent(
                        store_id=sender_config.store_id,
                        contact_id=contact.id,
                        campaign_id=campaign_id,
                        type="sent"
                    )
                    db_job.add(evt)
                    db_job.commit()

            local_campaign.status = "completed"
            local_campaign.sent_count = sent_count
            db_job.commit()
            logger.info(f"Campaign {campaign_id} batch dispatch finished. Sent count: {sent_count}")
        finally:
            db_job.close()

    background_tasks.add_task(dispatch_loop)
    campaign.status = "sending"
    db.commit()

    return {"status": "sending", "message": f"Campaign successfully queued in background for {len(eligible_contacts)} contacts."}


# ── 5. SECURE COMPLIANCE & URL TRACKING ROUTERS ──
@router.get("/track/click")
def secure_tracking_click_redirect(p: str, s: str, db: Session = Depends(get_db)):
    """Secure signed HMAC click-redirect to prevent open redirects."""
    try:
        data = verify_tracking_link(p, s)
        original_url = data["original_url"]
        contact_id = data["contact_id"]
        campaign_id = data["campaign_id"]
        flow_run_id = data["flow_run_id"]

        # Log Click Event
        evt = EmailEvent(
            store_id="General",
            contact_id=contact_id,
            campaign_id=campaign_id,
            flow_run_id=flow_run_id,
            type="clicked",
            metadata_json=json.dumps({"url": original_url})
        )
        db.add(evt)
        db.commit()

        # Temporary Redirect to safe validated target
        return RedirectResponse(url=original_url, status_code=302)
    except Exception as e:
        logger.error(f"Failed to verify HMAC redirect tracking link: {e}")
        raise HTTPException(status_code=403, detail="Unauthorized tracking redirect signature.")

@router.get("/track/open/{campaign_id}/{contact_id}.gif")
def tracking_open_pixel(campaign_id: str, contact_id: str, db: Session = Depends(get_db)):
    """Serves a silent transparent 1x1 GIF logging opened events."""
    try:
        c_id = int(contact_id)
        # Log Open Event
        evt = EmailEvent(
            store_id="General",
            contact_id=c_id,
            campaign_id=int(campaign_id) if campaign_id.isdigit() else None,
            type="opened"
        )
        db.add(evt)
        db.commit()
    except Exception as e:
        logger.error(f"Error logging open pixel tracking: {e}")

    # Standard transparent 1x1 GIF byte contents
    pixel_gif = base64.b64decode(b"R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")
    return Response(content=pixel_gif, media_type="image/gif")

@router.get("/unsubscribe")
def standard_one_click_unsubscribe(c_id: int, db: Session = Depends(get_db)):
    """One-click unsubscribe router (transitions states and records suppression logs)."""
    contact = db.query(Contact).filter(Contact.id == c_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Subscriber record not found.")

    if contact.consent_status != "unsubscribed":
        contact.consent_status = "unsubscribed"
        contact.unsubscribed_at = datetime.now(timezone.utc)
        
        # Add to Suppression table
        existing_supp = db.query(Suppression).filter(Suppression.store_id == contact.store_id, Suppression.email == contact.email).first()
        if not existing_supp:
            supp = Suppression(
                store_id=contact.store_id,
                email=contact.email,
                reason="unsubscribe"
            )
            db.add(supp)
            
        # Log Unsubscribe Event
        evt = EmailEvent(
            store_id=contact.store_id,
            contact_id=contact.id,
            type="unsubscribed"
        )
        db.add(evt)
        db.commit()

    return Response(
        content="""
        <html>
        <head><title>Unsubscribed</title></head>
        <body style="font-family: sans-serif; display:flex; justify-content:center; align-items:center; height:100vh; background:#f8fafc; margin:0;">
            <div style="background:#ffffff; padding:40px; border-radius:12px; border:1px solid #e2e8f0; max-width:400px; text-align:center; box-shadow:0 4px 6px -1px rgb(0 0 0 / 0.05);">
                <div style="font-size:48px; margin-bottom:16px;">✉️</div>
                <h2 style="color:#0f172a; margin:0 0 12px 0;">Unsubscribed Successfully</h2>
                <p style="color:#64748b; font-size:14px; line-height:1.5; margin:0 0 24px 0;">You have been successfully removed from our marketing mailing lists. You will no longer receive newsletters or promotional emails.</p>
                <div style="font-size:11px; color:#94a3b8;">If this was a mistake, you can opt back in at checkout next time.</div>
            </div>
        </body>
        </html>
        """,
        media_type="text/html"
    )

@router.post("/events/track")
def track_event(payload: dict, db: Session = Depends(get_db)):
    """Ingest storefront events, validate idempotency, and trigger active sequences."""
    event_type = payload.get("event") # e.g. astro_add_to_cart
    email = payload.get("email", "").strip().lower()
    store_id = payload.get("store_id", "WaiRaiders Store")
    idempotency_key = payload.get("idempotency_key")
    variables = payload.get("variables", {}) # Cart data or order info

    if not event_type or not email or not idempotency_key:
        raise HTTPException(status_code=400, detail="Missing required parameters.")

    # Idempotency Check
    from models.flow_run import FlowRun
    existing_run = db.query(FlowRun).filter(FlowRun.idempotency_key == idempotency_key).first()
    if existing_run:
        return {
            "status": "skipped",
            "message": "Event already processed (idempotency key matched).",
            "flow_run_id": existing_run.id
        }

    # Verify if Contact exists or create one
    contact = db.query(Contact).filter(Contact.store_id == store_id, Contact.email == email).first()
    if not contact:
        contact = Contact(
            store_id=store_id,
            email=email,
            consent_status="subscribed",
            consent_source="checkout_opt_in"
        )
        db.add(contact)
        db.commit()
        db.refresh(contact)

    # Check for active flow matching trigger_event
    from models.automation_flow import AutomationFlow
    flow = db.query(AutomationFlow).filter(
        AutomationFlow.store_id == store_id,
        AutomationFlow.trigger_event == event_type,
        AutomationFlow.is_active == True
    ).first()
    if not flow:
        return {
            "status": "skipped",
            "message": f"No active automation flow found matching trigger event '{event_type}'."
        }

    # Create new FlowRun
    flow_run = FlowRun(
        store_id=store_id,
        flow_id=flow.id,
        flow_version=flow.version,
        contact_id=contact.id,
        status="active",
        current_node_id=None,
        variables_json=json.dumps(variables),
        next_execution_at=datetime.now(timezone.utc),
        idempotency_key=idempotency_key
    )
    db.add(flow_run)
    db.commit()
    db.refresh(flow_run)

    # Dispatch the background Celery task to execute first step of the flow!
    from tasks import execute_flow_step
    execute_flow_step.delay(flow_run.id, 0)

    return {
        "status": "success",
        "message": f"Triggered automation flow run {flow_run.id}.",
        "flow_run_id": flow_run.id
    }

