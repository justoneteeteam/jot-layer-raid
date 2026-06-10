import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models.store import Store

def main():
    db = SessionLocal()
    try:
        # Clear any existing store config to avoid duplicates
        db.query(Store).filter(
            Store.url == "https://vulius.com"
        ).delete(synchronize_session=False)

        # Add Vulius Store
        vulius = Store(
            name="Vulius Store",
            platform="woocommerce",
            url="https://vulius.com",
            api_key="ck_3259a8fb855102bc1efe5b0fd09cb182dac89e2b",
            api_secret="cs_41955898a919ee37e5a29792a7ed2f8a21f59a6f",
            is_active=True
        )
        db.add(vulius)
        db.commit()
        print("✅ Successfully added Vulius Store (WooCommerce) to database!")
    except Exception as e:
        db.rollback()
        print(f"❌ Error adding store: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
