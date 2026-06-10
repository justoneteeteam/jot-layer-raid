import sys
import os

# Add apps/api directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from database import SessionLocal
    from models.email_sender_identity import EmailSenderIdentity
except ImportError as e:
    print(f"Error importing database models: {e}")
    print("Please run this script from the apps/api folder.")
    sys.exit(1)

def main():
    print("=========================================================")
    print("📧 WaiRaiders Resend Email Configurator")
    print("=========================================================")

    api_key = input("Enter your Resend API Key (starts with re_): ").strip()
    if not api_key:
        print("❌ Resend API Key is required.")
        return

    from_email = input("Enter your from email address (default: contact@wairaiders.com): ").strip() or "contact@wairaiders.com"

    db = SessionLocal()
    try:
        # Check if there's an existing sender identity for wairaiders.com
        sender = db.query(EmailSenderIdentity).filter(
            EmailSenderIdentity.domain == "wairaiders.com"
        ).first()

        if sender:
            print(f"Found existing sender config for {sender.domain}. Updating...")
        else:
            print(f"No existing sender config for wairaiders.com. Creating new one...")
            sender = EmailSenderIdentity(domain="wairaiders.com")
            db.add(sender)

        sender.store_id = "WaiRaiders Store"
        sender.provider = "resend"
        sender.from_name = "WaiRaiders Support"
        sender.from_email = from_email
        sender.reply_to_email = from_email
        sender.provider_config_ref = api_key
        sender.status = "active"

        db.commit()
        print("=========================================================")
        print("🎉 SUCCESS! WaiRaiders is now connected to Resend.")
        print(f"Replies will be sent from: {from_email}")
        print("Please deploy your changes to Railway to apply them in production.")
        print("=========================================================")
    except Exception as e:
        db.rollback()
        print(f"❌ Error updating config: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
