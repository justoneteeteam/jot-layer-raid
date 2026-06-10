import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models.store import Store

def main():
    db = SessionLocal()
    try:
        # Delete old WooCommerce reference to avoid duplicates
        db.query(Store).filter(
            Store.url == "https://vulius.com"
        ).delete(synchronize_session=False)

        # Insert new Astro platform store reference
        vulius = Store(
            name="Vulius Astro Store",
            platform="astro",
            url="https://vulius.com",
            api_key="astro_test_key_vulius_123",
            api_secret="astro_secret_test_secret_vulius_456",
            is_active=True
        )
        db.add(vulius)
        db.commit()
        print("✅ Successfully updated Vulius Store to Astro platform in database!")
    except Exception as e:
        db.rollback()
        print(f"❌ Error updating store: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
