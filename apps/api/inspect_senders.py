import sys
import os

# Add apps/api directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models.email_sender_identity import EmailSenderIdentity

def main():
    db = SessionLocal()
    try:
        senders = db.query(EmailSenderIdentity).all()
        print("--- CURRENT EMAIL SENDER IDENTITIES ---")
        for s in senders:
            print(f"ID: {s.id} | Store: {s.store_id} | Provider: {s.provider} | Name: {s.from_name} | Email: {s.from_email} | Domain: {s.domain} | Status: {s.status}")
        print("---------------------------------------")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
