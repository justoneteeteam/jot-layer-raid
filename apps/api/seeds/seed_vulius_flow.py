import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal, Base, engine
from models.email_sender_identity import EmailSenderIdentity
from models.email_template import EmailTemplate
from models.automation_flow import AutomationFlow

# Trigger explicit SQLAlchemy creation of all registered metadata schemas just in case
Base.metadata.create_all(bind=engine)

def seed_vulius_flow():
    db = SessionLocal()
    try:
        print("🔍 Checking Vulius Store sender identity...")
        sender = db.query(EmailSenderIdentity).filter(
            EmailSenderIdentity.store_id == "Vulius Store",
            EmailSenderIdentity.from_email == "contact@vulius.com"
        ).first()
        
        if not sender:
            # If not present for some reason, create it
            print("⚠️ contact@vulius.com sender identity not found. Creating a new one...")
            sender = EmailSenderIdentity(
                store_id="Vulius Store",
                provider="resend",
                from_name="Vulius Store",
                from_email="contact@vulius.com",
                reply_to_email="contact@vulius.com",
                domain="vulius.com",
                status="active",
                provider_config_ref="re_mock_api_key_12345"
            )
            db.add(sender)
            db.commit()
            db.refresh(sender)
            print(f"✅ Created EmailSenderIdentity with ID: {sender.id}")
        else:
            print(f"✅ Found existing EmailSenderIdentity with ID: {sender.id}")
            
        sender_id = sender.id

        # 2. Upsell Template
        upsell_name = "Vulius Checkout Follow-up - Upsell"
        upsell_subject = "Unlock Your Exclusive Custom Jersey Deal, {customer_name}!"
        upsell_html = """
<div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 24px; background: #0f172a; color: #f8fafc; border-radius: 16px; border: 1px solid #1e293b; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3);">
    <div style="text-align: center; margin-bottom: 32px;">
        <span style="font-size: 30px; font-weight: 900; letter-spacing: -0.05em; background: linear-gradient(to right, #38bdf8, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">VULIUS</span>
    </div>
    <h2 style="color: #38bdf8; text-align: center; margin-top: 0; font-size: 24px; font-weight: 800; line-height: 1.3;">Complete Your Custom Jersey Design!</h2>
    <p style="font-size: 15px; color: #cbd5e1; line-height: 1.6; margin-top: 20px;">
        Hi {customer_name},<br/><br/>
        We noticed you left your custom-tailored jersey design in your cart. Our premium AI-layered compositor has saved your exact setup (custom nameplate, numbers, and patches) so you don't lose it!
    </p>
    <p style="font-size: 15px; color: #cbd5e1; line-height: 1.6;">
        To help you step onto the field in style, we are offering an exclusive <strong>15% OFF</strong> on your checkout today. Use the code below at checkout:
    </p>
    <div style="text-align: center; margin: 28px 0;">
        <div style="display: inline-block; padding: 14px 28px; background: #1e293b; border: 1px dashed #38bdf8; color: #38bdf8; font-family: 'Courier New', Courier, monospace; font-size: 22px; font-weight: bold; border-radius: 8px; letter-spacing: 2px;">
            VULIUS15
        </div>
    </div>
    <div style="text-align: center; margin: 32px 0;">
        <a href="https://vulius.com/checkout?code=VULIUS15" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #38bdf8 0%, #818cf8 100%); color: #ffffff; font-weight: bold; font-size: 15px; border-radius: 8px; text-decoration: none; box-shadow: 0 4px 12px rgba(56, 189, 248, 0.35); text-transform: uppercase; letter-spacing: 0.5px;">Claim 15% Off Now</a>
    </div>
    <p style="font-size: 12px; color: #64748b; text-align: center; margin-top: 28px; line-height: 1.5;">
        *This offer is valid for the next 24 hours. Custom compositions require additional processing time.
    </p>
</div>
        """.strip()

        # 3. Cross-sell Template
        cross_sell_name = "Vulius Cross-sell - New Collection Jersey"
        cross_sell_subject = "Complete your look with our new Jersey collection, {customer_name}!"
        cross_sell_html = """
<div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 24px; background: #0f172a; color: #f8fafc; border-radius: 16px; border: 1px solid #1e293b; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3);">
    <div style="text-align: center; margin-bottom: 32px;">
        <span style="font-size: 30px; font-weight: 900; letter-spacing: -0.05em; background: linear-gradient(to right, #38bdf8, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">VULIUS</span>
    </div>
    <h2 style="color: #818cf8; text-align: center; margin-top: 0; font-size: 24px; font-weight: 800; line-height: 1.3;">Discover Our New Jersey Collection!</h2>
    <p style="font-size: 15px; color: #cbd5e1; line-height: 1.6; margin-top: 20px;">
        Hi {customer_name},<br/><br/>
        Elevate your game day styling. We have just dropped our latest <strong>Vulius Jersey Collection</strong>, engineered for ultimate comfort and custom player styling.
    </p>
    <p style="font-size: 15px; color: #cbd5e1; line-height: 1.6;">
        From breathable mesh paneling to high-definition sublimated nameplates, explore the freshest designs chosen by pro players this season.
    </p>
    <div style="text-align: center; margin: 32px 0;">
        <a href="https://vulius.com/collections/new-jersey" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #818cf8 0%, #38bdf8 100%); color: #ffffff; font-weight: bold; font-size: 15px; border-radius: 8px; text-decoration: none; box-shadow: 0 4px 12px rgba(129, 140, 248, 0.35); text-transform: uppercase; letter-spacing: 0.5px;">Explore New Collection</a>
    </div>
    <p style="font-size: 13px; color: #94a3b8; line-height: 1.6; text-align: center;">
        Get free shipping on all orders over $75. Custom names and numbers included at no extra cost.
    </p>
</div>
        """.strip()

        # Seed/Update templates
        def get_or_create_template(name, subject, html):
            template = db.query(EmailTemplate).filter(
                EmailTemplate.store_id == "Vulius Store",
                EmailTemplate.name == name
            ).first()
            if not template:
                print(f"Creating new email template: {name}")
                template = EmailTemplate(
                    store_id="Vulius Store",
                    name=name,
                    subject=subject,
                    body_html=html
                )
                db.add(template)
                db.commit()
                db.refresh(template)
            else:
                print(f"Template '{name}' already exists. Updating body HTML and subject...")
                template.subject = subject
                template.body_html = html
                db.commit()
                db.refresh(template)
            return template

        upsell_temp = get_or_create_template(upsell_name, upsell_subject, upsell_html)
        cross_sell_temp = get_or_create_template(cross_sell_name, cross_sell_subject, cross_sell_html)

        print(f"✅ Upsell Template ID: {upsell_temp.id}")
        print(f"✅ Cross-sell Template ID: {cross_sell_temp.id}")

        # 4. Automation Flow Schema Setup
        flow_name = "Vulius Checkout Follow-up & Cross-sell Flow"
        trigger_event = "checkout_started"

        steps = [
            {
                "id": "vulius_node_1",
                "type": "wait",
                "duration_hours": 1
            },
            {
                "id": "vulius_node_2",
                "type": "suppression_check"
            },
            {
                "id": "vulius_node_3",
                "type": "send_email",
                "template_id": upsell_temp.id
            },
            {
                "id": "vulius_node_4",
                "type": "wait",
                "duration_hours": 24
            },
            {
                "id": "vulius_node_5",
                "type": "suppression_check"
            },
            {
                "id": "vulius_node_6",
                "type": "send_email",
                "template_id": cross_sell_temp.id
            }
        ]

        compiled_schema = {
            "trigger": trigger_event,
            "steps": steps,
            "sender_identity_id": sender_id
        }

        # Seed/Update Flow
        flow = db.query(AutomationFlow).filter(
            AutomationFlow.store_id == "Vulius Store",
            AutomationFlow.name == flow_name
        ).first()

        if not flow:
            print("Creating new AutomationFlow...")
            flow = AutomationFlow(
                store_id="Vulius Store",
                name=flow_name,
                trigger_event=trigger_event,
                visual_schema_json="{}",
                compiled_schema_json=json.dumps(compiled_schema),
                version=1,
                is_active=True
            )
            db.add(flow)
        else:
            print("Flow already exists. Updating schema and settings...")
            flow.trigger_event = trigger_event
            flow.compiled_schema_json = json.dumps(compiled_schema)
            flow.version += 1
            flow.is_active = True

        db.commit()
        db.refresh(flow)
        print(f"✅ Successfully seeded AutomationFlow with ID: {flow.id}")
        print("🌱 Seeding finished successfully!")

    except Exception as e:
        db.rollback()
        print(f"❌ Error during seed: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_vulius_flow()
