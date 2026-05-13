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

# Create all tables
Base.metadata.create_all(bind=engine)

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
