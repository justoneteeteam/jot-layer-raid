"""Standalone migration fix — run this if the app startup migration fails."""
from sqlalchemy import text, inspect, create_engine
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Use the DATABASE_URL from environment
DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    from config import settings
    DATABASE_URL = settings.DATABASE_URL

logger.info(f"Connecting to database: {DATABASE_URL[:30]}...")
engine = create_engine(DATABASE_URL)

inspector = inspect(engine)
table_names = inspector.get_table_names()
logger.info(f"Tables found: {table_names}")

with engine.begin() as conn:
    if "mockup_templates" in table_names:
        existing = {c["name"] for c in inspector.get_columns("mockup_templates")}
        logger.info(f"mockup_templates columns: {existing}")

        if "canvas_json" not in existing:
            conn.execute(text("ALTER TABLE mockup_templates ADD COLUMN canvas_json JSON"))
            logger.info("Added canvas_json")
        else:
            logger.info("canvas_json already exists")

        if "background_color" not in existing:
            conn.execute(text("ALTER TABLE mockup_templates ADD COLUMN background_color VARCHAR DEFAULT '#e5e7eb'"))
            logger.info("Added background_color")
        else:
            logger.info("background_color already exists")

        # Drop old columns if present
        for old_col in ["blank_image_url", "name_layer_url", "number_layer_url", "text_positions", "separation_status"]:
            if old_col in existing:
                conn.execute(text(f"ALTER TABLE mockup_templates DROP COLUMN {old_col}"))
                logger.info(f"Dropped {old_col}")
    else:
        logger.warning("mockup_templates table not found!")

logger.info("Migration complete.")
