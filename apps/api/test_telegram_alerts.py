import os
import sys
import html
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add apps/api to python module lookup path
sys.path.append("/Users/lukepham/.gemini/antigravity/scratch/jot-layer-raid/apps/api")

from database import Base
from models.order import Order
from models.ticket import Ticket
import routers.oms as oms

# Keep track of captured messages for asserting
captured_messages = []

# Mock the send_telegram_notification helper to capture compiled templates
def mock_send_telegram_notification(message: str) -> bool:
    print(f"\n📢 [MOCK TELEGRAM DISPATCH] Message Length: {len(message)}")
    print("=" * 60)
    print(message)
    print("=" * 60)
    captured_messages.append(message)
    return True

# Monkeypatch
oms.send_telegram_notification = mock_send_telegram_notification

# Setup local SQLite test database
TEST_DB_URL = "sqlite:///test_telegram_run.db"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
SessionLocalTest = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Initialize database schema
Base.metadata.create_all(bind=engine)
db = SessionLocalTest()

# Clean up database
db.query(Order).filter(Order.order_id == "777701").delete()
db.query(Ticket).filter(Ticket.customer_email == "tester@example.com").delete()
db.commit()

print("\n🧪 --- TEST CASE 1: Inbound Email support Ticket (New Ticket) ---")
mock_email_payload = {
    "sender": "tester@example.com",
    "sender_name": "Test Customer",
    "subject": "Need size change for jersey <urgent>",
    "body_text": "Hi Support Team,\n\nI just bought a custom jersey but realized I need size L instead of M. Can you please modify that for me?\n\nThanks!\nTest Customer"
}

# Inbound email webhook secret config
os.environ["INBOUND_EMAIL_SECRET"] = "TEST_SECRET"
res1 = oms.inbound_support_email_webhook(payload=mock_email_payload, secret="TEST_SECRET", db=db)
print("New Support Ticket Result:", res1)

# Verify captured message
assert len(captured_messages) == 1, "Should have captured 1 Telegram alert"
assert "New Support Ticket" in captured_messages[-1], "Alert should indicate it's a new ticket"
assert "tester@example.com" in captured_messages[-1]
assert "Need size change for jersey &lt;urgent&gt;" in captured_messages[-1], "HTML escaping should be working"
assert "L instead of M" in captured_messages[-1]

print("✅ Test Case 1 passed successfully!")


print("\n🧪 --- TEST CASE 2: Inbound Email support Ticket (Threaded Reply) ---")
mock_reply_payload = {
    "sender": "tester@example.com",
    "sender_name": "Test Customer",
    "subject": "Re: Need size change for jersey <urgent>",
    "body_text": "Also, please make sure the custom name is 'ANTIGRAVITY'."
}

res2 = oms.inbound_support_email_webhook(payload=mock_reply_payload, secret="TEST_SECRET", db=db)
print("Threaded Reply Result:", res2)

assert len(captured_messages) == 2, "Should have captured 2 Telegram alerts"
assert "Update - Customer Reply" in captured_messages[-1], "Alert should indicate it's a customer reply"
assert "ANTIGRAVITY" in captured_messages[-1]

print("✅ Test Case 2 passed successfully!")


print("\n🧪 --- TEST CASE 3: WooCommerce New Order Created Webhook ---")
mock_order_payload = {
    "id": 777701,
    "number": "WOC-777701",
    "status": "processing",
    "total": "129.99",
    "date_created": "2026-05-29T12:00:00",
    "billing": {
        "first_name": "Antigravity",
        "last_name": "Team",
        "email": "tester@example.com",
        "address_1": "1 Infinite Loop",
        "city": "Cupertino",
        "state": "CA",
        "postcode": "95014",
        "country": "US"
    },
    "line_items": [
        {
            "name": "Customized Elite Team Jersey <Special>",
            "quantity": 2,
            "meta_data": [
                {
                    "key": "_WCPA_order_meta_data",
                    "value": [
                        {"label": "Size", "value": "XL"},
                        {"label": "Custom Your Name", "value": "SPEEDY"},
                        {"label": "Custom Number", "value": "99"}
                    ]
                }
            ]
        }
    ]
}

res3 = oms.woocommerce_order_created_webhook(payload=mock_order_payload, store="vulius", db=db)
print("Order Created Webhook Result:", res3)

assert len(captured_messages) == 3, "Should have captured 3 Telegram alerts"
assert "New Order Received" in captured_messages[-1]
assert "Vulius Store" in captured_messages[-1]
assert "Antigravity Team" in captured_messages[-1]
assert "Customized Elite Team Jersey &lt;Special&gt;" in captured_messages[-1], "HTML escaping should be working for order line items"
assert "Size: XL" in captured_messages[-1]
assert "Custom Name: SPEEDY" in captured_messages[-1]
assert "Custom Number: 99" in captured_messages[-1]

print("✅ Test Case 3 passed successfully!")

# Clean up database test rows
db.query(Order).filter(Order.order_id == "777701").delete()
db.query(Ticket).filter(Ticket.customer_email == "tester@example.com").delete()
db.commit()
db.close()

if os.path.exists("test_telegram_run.db"):
    os.remove("test_telegram_run.db")

print("\n💯 All local Telegram Alert tests passed flawlessly!")
