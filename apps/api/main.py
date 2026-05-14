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

# Create all tables (only creates NEW tables, not columns)
Base.metadata.create_all(bind=engine)

# Migrate schema — add columns that may be missing on existing tables
def _run_migrations():
    """Add columns that create_all won't add to existing tables."""
    from sqlalchemy import text, inspect
    
    inspector = inspect(engine)
    
    with engine.connect() as conn:
        # ── fonts table: add team_id, jersey_type ──
        if "fonts" in inspector.get_table_names():
            existing = {c["name"] for c in inspector.get_columns("fonts")}
            if "team_id" not in existing:
                conn.execute(text("ALTER TABLE fonts ADD COLUMN team_id INTEGER REFERENCES teams(id)"))
            if "jersey_type" not in existing:
                conn.execute(text("ALTER TABLE fonts ADD COLUMN jersey_type VARCHAR"))
        
        # ── mockup_templates table: add canvas_json, background_color ──
        if "mockup_templates" in inspector.get_table_names():
            existing = {c["name"] for c in inspector.get_columns("mockup_templates")}
            if "canvas_json" not in existing:
                conn.execute(text("ALTER TABLE mockup_templates ADD COLUMN canvas_json JSON"))
            if "background_color" not in existing:
                conn.execute(text("ALTER TABLE mockup_templates ADD COLUMN background_color VARCHAR DEFAULT '#e5e7eb'"))
            # Remove old AI separation columns if they exist
            for old_col in ["blank_image_url", "name_layer_url", "number_layer_url", "text_positions", "separation_status"]:
                if old_col in existing:
                    conn.execute(text(f"ALTER TABLE mockup_templates DROP COLUMN IF EXISTS {old_col}"))
        
        conn.commit()

try:
    _run_migrations()
except Exception as e:
    import logging
    logging.getLogger(__name__).warning(f"Migration check: {e}")

app = FastAPI(
    title="JOTLayerRaid API",
    description="Jersey Mockup Bulk Generation & Multi-Store Manager",
    version="0.1.0",
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


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "JOTLayerRaid API"}
