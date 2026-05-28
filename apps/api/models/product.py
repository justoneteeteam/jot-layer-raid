from sqlalchemy import Column, Integer, String, Float, DateTime
from database import Base
from datetime import datetime, timezone


class Product(Base):
    __tablename__ = "synced_products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    platform_product_id = Column(String, nullable=True, index=True)
    platform = Column(String, nullable=False)  # woocommerce, shopbase, astro
    image_url = Column(String, nullable=True)
    price = Column(Float, default=0.0)
    sku = Column(String, nullable=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
