from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float
from database import Base
from datetime import datetime, timezone


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(String, nullable=True, index=True)  # e.g., WOC 3065, SB_14632
    order_id = Column(String, nullable=True, index=True)  # e.g., 30653, #wairaiders6301
    order_name = Column(String, nullable=True, index=True)  # e.g., 3065, 4632
    customer_name = Column(String, nullable=False, index=True)
    customer_address = Column(String, nullable=False)
    customer_email = Column(String, nullable=True, index=True)  # Email
    product_name = Column(String, nullable=False)
    product_image = Column(String, nullable=True)
    quantity = Column(Integer, default=1)
    variant = Column(String, nullable=True)  # e.g., Men Size XL
    variant_value = Column(String, nullable=True)  # e.g., XL
    revenue = Column(Float, default=0.0)  # total charges / Revenue
    cost = Column(Float, default=0.0)  # supplier cost
    shipping_status = Column(String, default="placed")  # placed, in transit, delivered, incident
    tracking_number = Column(String, nullable=True, index=True)
    email_sent = Column(Boolean, default=False)
    tracking_email_sent = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    synced_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
