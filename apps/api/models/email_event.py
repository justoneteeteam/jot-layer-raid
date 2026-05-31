from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from database import Base
from datetime import datetime, timezone

class EmailEvent(Base):
    __tablename__ = "email_events"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(String, index=True, nullable=False)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=False)
    campaign_id = Column(Integer, nullable=True)
    flow_run_id = Column(Integer, nullable=True)
    type = Column(String, index=True, nullable=False) # sent, delivered, opened, clicked, bounced, complained, unsubscribed
    metadata_json = Column(Text, nullable=True) # User-Agent, clicked URL, IP location
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
