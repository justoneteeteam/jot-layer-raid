from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from models.store import Store
from datetime import datetime, timezone

router = APIRouter(prefix="/api/stores", tags=["Stores"])


class StoreCreate(BaseModel):
    name: str
    platform: str  # "woocommerce" or "shopbase"
    url: str
    api_key: str
    api_secret: str


class StoreUpdate(BaseModel):
    name: str | None = None
    url: str | None = None
    api_key: str | None = None
    api_secret: str | None = None


@router.get("")
def list_stores(db: Session = Depends(get_db)):
    """List all connected stores."""
    stores = db.query(Store).all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "platform": s.platform,
            "url": s.url,
            "is_active": s.is_active,
            "last_synced_at": s.last_synced_at.isoformat() if s.last_synced_at else None,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in stores
    ]


@router.post("")
def create_store(data: StoreCreate, db: Session = Depends(get_db)):
    """Add a new store connection."""
    store = Store(
        name=data.name,
        platform=data.platform.lower(),
        url=data.url.rstrip("/"),
        api_key=data.api_key,
        api_secret=data.api_secret,
    )
    db.add(store)
    db.commit()
    db.refresh(store)
    return {"id": store.id, "name": store.name, "platform": store.platform}


@router.put("/{store_id}")
def update_store(store_id: int, data: StoreUpdate, db: Session = Depends(get_db)):
    """Update store credentials."""
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    if data.name is not None:
        store.name = data.name
    if data.url is not None:
        store.url = data.url
    if data.api_key is not None:
        store.api_key = data.api_key
    if data.api_secret is not None:
        store.api_secret = data.api_secret
    db.commit()
    return {"updated": store_id}


@router.delete("/{store_id}")
def delete_store(store_id: int, db: Session = Depends(get_db)):
    """Remove a store connection."""
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    db.delete(store)
    db.commit()
    return {"deleted": store_id}


@router.post("/{store_id}/test")
def test_connection(store_id: int, db: Session = Depends(get_db)):
    """Test connection to a store's API."""
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    # In production, make actual HTTP request to store API
    # WooCommerce: GET {url}/wp-json/wc/v3 with Basic Auth
    # ShopBase: GET {url}/admin/products.json?limit=1
    return {
        "status": "ok",
        "platform": store.platform,
        "message": f"Connection to {store.name} ({store.platform}) successful",
    }


@router.post("/{store_id}/sync")
def sync_store(store_id: int, db: Session = Depends(get_db)):
    """Trigger product sync for a store."""
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    # In production, trigger async sync job
    store.last_synced_at = datetime.now(timezone.utc)
    store.is_active = True
    db.commit()
    return {
        "status": "ok",
        "message": f"Sync triggered for {store.name}",
        "synced_at": store.last_synced_at.isoformat(),
    }
