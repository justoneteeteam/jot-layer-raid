import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal, engine, Base
from models.email_sender_identity import EmailSenderIdentity
from models.contact import Contact
from models.suppression import Suppression
from models.email_template import EmailTemplate
from models.automation_flow import AutomationFlow

# Trigger explicit SQLAlchemy creation of all registered metadata schemas
Base.metadata.create_all(bind=engine)

def seed_marketing():
    db = SessionLocal()
    try:
        # 1. Seed Outbound Senders
        if not db.query(EmailSenderIdentity).first():
            wairaiders_sender = EmailSenderIdentity(
                store_id="WaiRaiders Store",
                provider="cloudflare",
                from_name="WaiRaiders Support",
                from_email="support@wairaiders.com",
                reply_to_email="support@wairaiders.com",
                domain="wairaiders.com",
                status="active"
            )
            vulius_sender = EmailSenderIdentity(
                store_id="Vulius Store",
                provider="resend",
                from_name="Vulius Sales",
                from_email="sales@vulius.com",
                reply_to_email="sales@vulius.com",
                domain="vulius.com",
                status="active",
                provider_config_ref="re_mock_api_key_12345"
            )
            db.add(wairaiders_sender)
            db.add(vulius_sender)
            print("✅ Seeded EmailSenderIdentity records.")

        # 2. Seed Templates
        if not db.query(EmailTemplate).first():
            cart_temp = EmailTemplate(
                store_id="WaiRaiders Store",
                name="Abandoned Cart Reminder",
                subject="Did you leave something behind, {customer_name}?",
                body_html="""
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background:#fff; border:1px solid #e2e8f0; border-radius:12px;">
                    <h2 style="color: #f97316; margin-top:0;">Complete Your Purchase!</h2>
                    <p style="font-size:15px; color:#475569; line-height:1.6;">Hi {customer_name},<br/><br/>We noticed you added an amazing customized jersey to your cart but didn't check out. We saved your items for you! Click the link below to resume shopping immediately:</p>
                    <div style="text-align:center; margin:32px 0;">
                        <a href="https://wairaiders.com/cart" style="display:inline-block; padding:12px 28px; background:#f97316; color:#fff; font-weight:bold; border-radius:6px; text-decoration:none;">Resume Checkout Now</a>
                    </div>
                    <p style="font-size:12px; color:#94a3b8;">Hurry, stock is extremely limited for custom NFL designs!</p>
                </div>
                """
            )
            db.add(cart_temp)
            print("✅ Seeded EmailTemplate records.")

        # 3. Seed Contacts
        if not db.query(Contact).first():
            contacts = [
                Contact(store_id="WaiRaiders Store", email="lukepham@example.com", first_name="Luke", last_name="Pham", consent_status="subscribed", consent_source="csv_import"),
                Contact(store_id="WaiRaiders Store", email="buyer1@example.com", first_name="John", last_name="Doe", consent_status="subscribed", consent_source="checkout_opt_in"),
                Contact(store_id="WaiRaiders Store", email="active@example.com", first_name="Sarah", last_name="Smith", consent_status="subscribed", consent_source="checkout_opt_in"),
                Contact(store_id="WaiRaiders Store", email="unsub@example.com", first_name="Bob", last_name="Brown", consent_status="unsubscribed", consent_source="popup")
            ]
            for c in contacts:
                db.add(c)
            print("✅ Seeded Contact records.")

        # 4. Seed Suppressions
        if not db.query(Suppression).first():
            supp = Suppression(
                store_id="WaiRaiders Store",
                email="blocked_user@example.com",
                reason="bounce"
            )
            db.add(supp)
            print("✅ Seeded Suppression records.")

        # 5. Seed Automation Flow (Astro Abandoned Cart Flow)
        if not db.query(AutomationFlow).first():
            compiled_schema = {
                "trigger": "astro_add_to_cart",
                "steps": [
                    {
                        "id": "node_1",
                        "type": "wait",
                        "duration_hours": 1
                    },
                    {
                        "id": "node_2",
                        "type": "suppression_check"
                    },
                    {
                        "id": "node_3",
                        "type": "send_email",
                        "template_id": 1
                    }
                ]
            }
            flow = AutomationFlow(
                store_id="WaiRaiders Store",
                name="Astro Abandoned Cart Sequence",
                trigger_event="astro_add_to_cart",
                visual_schema_json="{}",
                compiled_schema_json=json.dumps(compiled_schema),
                version=1,
                is_active=True
            )
            db.add(flow)
            print("✅ Seeded AutomationFlow records.")

        db.commit()
        print("🌱 Seeding of marketing infrastructure completed successfully.")
    except Exception as e:
        db.rollback()
        print(f"❌ Seed failed: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_marketing()
