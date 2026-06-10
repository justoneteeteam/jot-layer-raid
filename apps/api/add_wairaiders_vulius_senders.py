import sys
import os

# Add apps/api directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models.email_sender_identity import EmailSenderIdentity

def main():
    db = SessionLocal()
    try:
        # Clear any existing domain config to avoid duplicates
        db.query(EmailSenderIdentity).filter(
            EmailSenderIdentity.domain.in_(["wairaiders.com", "vulius.com"])
        ).delete(synchronize_session=False)

        # Add WaiRaiders
        wairaiders = EmailSenderIdentity(
            store_id="WaiRaiders Store",
            provider="cloudflare",
            from_name="WaiRaiders Support",
            from_email="contact@wairaiders.com",
            reply_to_email="contact@wairaiders.com",
            domain="wairaiders.com",
            status="active"
        )
        db.add(wairaiders)

        # Add Vulius
        vulius = EmailSenderIdentity(
            store_id="Vulius Store",
            provider="cloudflare",
            from_name="Vulius Support",
            from_email="contact@vulius.com",
            reply_to_email="contact@vulius.com",
            domain="vulius.com",
            status="active"
        )
        db.add(vulius)

        db.commit()
        print("✅ Successfully added contact@wairaiders.com and contact@vulius.com to database!")
    except Exception as e:
        db.rollback()
        print(f"❌ Error adding identities: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
