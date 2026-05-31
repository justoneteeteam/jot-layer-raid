from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from database import Base
from datetime import datetime, timezone

class AutomationFlow(Base):
    __tablename__ = "automation_flows"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(String, index=True, nullable=False)
    name = Column(String, nullable=False)
    trigger_event = Column(String, nullable=False, index=True) # e.g. astro_add_to_cart
    visual_schema_json = Column(Text, nullable=True) # React Flow coordinates
    compiled_schema_json = Column(Text, nullable=False) # Execution steps
    version = Column(Integer, default=1)
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
