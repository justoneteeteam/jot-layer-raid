import os
import sys
import json
from fastapi.testclient import TestClient

# Ensureapps/api is in python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main import app
from database import SessionLocal, engine, Base
from models.ticket import Ticket

def run_inbound_email_tests():
    print("==================================================================")
    print("STARTING OMS INBOUND SUPPORT EMAIL INGESTION TEST SUITE")
    print("==================================================================")

    # 1. Setup temporary SQLite testing database tables
    print("\n[Step 1] Initializing testing database tables...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    client = TestClient(app)

    try:
        # Clean existing test entries if they exist
        db.query(Ticket).filter(Ticket.customer_email == "test_customer@example.com").delete()
        db.commit()

        # 2. Test Security Token Unauthorized Ingestion
        print("\n[Step 2] Testing Unauthorized Webhook Call (Missing Secret)...")
        payload = {
            "sender": "test_customer@example.com",
            "sender_name": "Test Customer",
            "recipient": "customer@vulius.com",
            "subject": "Size modification request",
            "body_text": "Hello, I want to change the size of my custom jersey."
        }
        res_unauth = client.post("/api/oms/webhook/email/inbound", json=payload)
        print(f"Status Code received: {res_unauth.status_code}")
        assert res_unauth.status_code == 401
        print("✅ Unauthorized call was successfully blocked with 401!")

        # 3. Test Authorized Inbound Webhook - Ticket Creation
        print("\n[Step 3] Testing Authorized Webhook Call - New Support Ticket...")
        res_create = client.post(
            "/api/oms/webhook/email/inbound?secret=JOT_INGESTION_SECRET",
            json=payload
        )
        print(f"Response: {res_create.json()}")
        assert res_create.status_code == 200
        data_create = res_create.json()
        assert data_create["status"] == "success"
        ticket_id = data_create["ticket_id"]
        print(f"✅ Ticket created successfully with ID: {ticket_id}!")

        # Verify DB entry
        ticket_db = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        assert ticket_db is not None
        assert ticket_db.customer_email == "test_customer@example.com"
        assert ticket_db.customer_name == "Test Customer"
        assert ticket_db.status == "open"
        assert ticket_db.message == "Hello, I want to change the size of my custom jersey."
        assert json.loads(ticket_db.replies) == []
        print("✅ DB record verified for first email ticket!")

        # 4. Test Authorized Inbound Webhook - Automatic Threading / Appending Reply
        print("\n[Step 4] Testing Authorized Webhook Call - Thread Matching & Appending...")
        followup_payload = {
            "sender": "test_customer@example.com",
            "sender_name": "Test Customer",
            "recipient": "customer@vulius.com",
            "subject": "Re: Size modification request",
            "body_text": "Also, can you please make it an XL instead of L?"
        }
        res_thread = client.post(
            "/api/oms/webhook/email/inbound?secret=JOT_INGESTION_SECRET",
            json=followup_payload
        )
        print(f"Response: {res_thread.json()}")
        assert res_thread.status_code == 200
        data_thread = res_thread.json()
        assert data_thread["status"] == "success"
        assert data_thread["ticket_id"] == ticket_id
        print("✅ Message successfully matched and appended to existing ticket thread!")

        # Verify DB entry again to check replies list
        db.expire_all()
        ticket_db_updated = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        replies = json.loads(ticket_db_updated.replies)
        print(f"Updated Replies in Database: {replies}")
        assert len(replies) == 1
        assert replies[0].startswith("[Customer Reply") and replies[0].endswith("Also, can you please make it an XL instead of L?")
        assert ticket_db_updated.status == "open"
        assert ticket_db_updated.recipient_email == "customer@vulius.com"
        print("✅ DB record verified: recipient_email and thread replies saved correctly!")
        print("✅ DB record verified: thread replies appended correctly!")

        # 5. Clean up testing records
        db.query(Ticket).filter(Ticket.customer_email == "test_customer@example.com").delete()
        db.commit()

        print("\n==================================================================")
        print("ALL TESTS PASSED: OMS INBOUND EMAIL INGESTION MODULE VALIDATED 100%")
        print("==================================================================")

    except AssertionError as ae:
        print(f"\n❌ ASSERTION ERROR: Test verification failed! details: {ae}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ EXCEPTION ERROR: {e}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    run_inbound_email_tests()
