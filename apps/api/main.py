from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from database import engine, Base
from routers import auth
from routers import fonts as fonts_router
from routers import patches as patches_router
from routers import database_import
from routers import stores as stores_router
from routers import mockups as mockups_router
from routers import bulk as bulk_router
from routers import oms as oms_router
from routers import marketing as marketing_router

# Create all tables (only creates NEW tables, not columns)
Base.metadata.create_all(bind=engine)

# Migrate schema — add columns that create_all won't add to existing tables
def _run_migrations():
    """Add columns that create_all won't add to existing tables."""
    from sqlalchemy import text, inspect
    import logging

    logger = logging.getLogger(__name__)
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    with engine.begin() as conn:  # auto-commits on success, rolls back on error
        # ── fonts table: add team_id, jersey_type ──
        if "fonts" in table_names:
            existing = {c["name"] for c in inspector.get_columns("fonts")}
            if "team_id" not in existing:
                conn.execute(text("ALTER TABLE fonts ADD COLUMN team_id INTEGER REFERENCES teams(id)"))
                logger.info("Added fonts.team_id")
            if "jersey_type" not in existing:
                conn.execute(text("ALTER TABLE fonts ADD COLUMN jersey_type VARCHAR"))
                logger.info("Added fonts.jersey_type")

        # ── mockup_templates table: add canvas_json, background_color ──
        if "mockup_templates" in table_names:
            existing = {c["name"] for c in inspector.get_columns("mockup_templates")}
            if "canvas_json" not in existing:
                conn.execute(text("ALTER TABLE mockup_templates ADD COLUMN canvas_json JSON"))
                logger.info("Added mockup_templates.canvas_json")
            if "background_color" not in existing:
                conn.execute(text("ALTER TABLE mockup_templates ADD COLUMN background_color VARCHAR DEFAULT '#e5e7eb'"))
                logger.info("Added mockup_templates.background_color")
            # Remove old AI separation columns if they exist
            for old_col in ["blank_image_url", "name_layer_url", "number_layer_url", "text_positions", "separation_status"]:
                if old_col in existing:
                    conn.execute(text(f"ALTER TABLE mockup_templates DROP COLUMN {old_col}"))
                    logger.info(f"Dropped mockup_templates.{old_col}")
        else:
            logger.info("mockup_templates table not found — will be created by create_all")
            logger.info(f"Tables found: {table_names}")

        # ── orders table: add tracking_email_sent ──
        if "orders" in table_names:
            existing = {c["name"] for c in inspector.get_columns("orders")}
            if "tracking_email_sent" not in existing:
                conn.execute(text("ALTER TABLE orders ADD COLUMN tracking_email_sent BOOLEAN DEFAULT FALSE"))
                logger.info("Added orders.tracking_email_sent")

        # ── tickets table: add recipient_email, tags, snoozed_until ──
        if "tickets" in table_names:
            existing = {c["name"] for c in inspector.get_columns("tickets")}
            if "recipient_email" not in existing:
                conn.execute(text("ALTER TABLE tickets ADD COLUMN recipient_email VARCHAR"))
                logger.info("Added tickets.recipient_email")
            if "tags" not in existing:
                conn.execute(text("ALTER TABLE tickets ADD COLUMN tags VARCHAR DEFAULT ''"))
                logger.info("Added tickets.tags")
            if "snoozed_until" not in existing:
                conn.execute(text("ALTER TABLE tickets ADD COLUMN snoozed_until TIMESTAMP"))
                logger.info("Added tickets.snoozed_until")

        # ── Cleanup mock tickets & mock orders ──
        if "tickets" in table_names:
            conn.execute(text("DELETE FROM tickets WHERE customer_email LIKE '%@example.com' OR customer_email = 'shelltalbot@gmail.com'"))
            logger.info("Cleaned up mock tickets from database.")
        if "orders" in table_names:
            conn.execute(text("DELETE FROM orders WHERE store_id LIKE 'MOCK_%' OR customer_email LIKE '%@example.com'"))
            logger.info("Cleaned up mock orders from database.")

_run_migrations()

import asyncio
from contextlib import asynccontextmanager

async def periodic_sync():
    """Background task to sync all active stores every 3 hours."""
    from database import SessionLocal
    from routers.oms import sync_orders
    import logging
    logger = logging.getLogger(__name__)

    # Wait 10 seconds after startup before running the first sync
    await asyncio.sleep(10)
    while True:
        try:
            logger.info("🕒 [Cron] Starting scheduled 3-hour sync for all platforms...")
            db = SessionLocal()
            try:
                # Run the sync_orders function in a threadpool so it doesn't block FastAPI's event loop
                await asyncio.to_thread(sync_orders, platform="all", db=db)
                logger.info("🕒 [Cron] Scheduled 3-hour sync completed successfully.")
            except Exception as e:
                logger.error(f"❌ [Cron] Error during scheduled sync: {e}")
            finally:
                db.close()
        except Exception as e:
            logger.error(f"❌ [Cron] Error in periodic sync scheduler loop: {e}")
        
        # Wait 3 hours (3 * 3600 seconds)
        await asyncio.sleep(3 * 3600)


async def periodic_unsnooze_tickets():
    """Background task to unsnooze tickets whose snooze duration has expired."""
    from database import SessionLocal
    from models.ticket import Ticket
    from datetime import datetime, timezone
    import json
    import logging
    logger = logging.getLogger(__name__)

    # Wait 5 seconds after startup
    await asyncio.sleep(5)
    while True:
        try:
            db = SessionLocal()
            try:
                now = datetime.now(timezone.utc).replace(tzinfo=None)
                expired_tickets = db.query(Ticket).filter(
                    Ticket.status == "snoozed",
                    Ticket.snoozed_until <= now
                ).all()
                if expired_tickets:
                    logger.info(f"⏰ [Cron] Found {len(expired_tickets)} expired snoozed tickets to reopen.")
                    for ticket in expired_tickets:
                        ticket.status = "open"
                        ticket.snoozed_until = None
                        
                        replies_list = []
                        if ticket.replies:
                            try:
                                replies_list = json.loads(ticket.replies)
                            except Exception:
                                pass
                        replies_list.append(f"[System Update | {datetime.now().strftime('%H:%M %d/%m')}] Ticket unsnoozed automatically after 24 hours.")
                        ticket.replies = json.dumps(replies_list)
                        
                    db.commit()
            except Exception as e:
                logger.error(f"❌ [Cron] Error during unsnoozing tickets: {e}")
            finally:
                db.close()
        except Exception as e:
            logger.error(f"❌ [Cron] Error in unsnooze loop: {e}")
            
        await asyncio.sleep(60) # check every minute


@asynccontextmanager
async def lifespan(app: FastAPI):
    import logging
    logger = logging.getLogger(__name__)
    logger.info("Starting background periodic sync task...")
    sync_task = asyncio.create_task(periodic_sync())
    unsnooze_task = asyncio.create_task(periodic_unsnooze_tickets())
    yield
    logger.info("Stopping background tasks...")
    sync_task.cancel()
    unsnooze_task.cancel()
    try:
        await asyncio.gather(sync_task, unsnooze_task, return_exceptions=True)
    except Exception:
        pass

app = FastAPI(
    title="JOTLayerRaid API",
    description="Jersey Mockup Bulk Generation & Multi-Store Manager",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow Next.js frontend (local + deployed)
_origins = list({
    "http://localhost:3000",
    settings.FRONTEND_URL,
})

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(fonts_router.router)
app.include_router(patches_router.router)
app.include_router(database_import.router)
app.include_router(stores_router.router)
app.include_router(mockups_router.router)
app.include_router(bulk_router.router)
app.include_router(oms_router.router)
app.include_router(marketing_router.router)




@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "JOTLayerRaid API"}
