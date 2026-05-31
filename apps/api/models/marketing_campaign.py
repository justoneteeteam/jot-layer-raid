from sqlalchemy import Column, Integer, String, Text, DateTime, func
from database import Base
from datetime import datetime, timezone

class MarketingCampaign(Base):
    __tablename__ = "marketing_campaigns"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    body_html = Column(Text, nullable=False)
    audience_list_id = Column(Integer, nullable=True) # Reference to listmonk segment list ID
    listmonk_campaign_id = Column(Integer, nullable=True)
    status = Column(String, default="draft") # draft, scheduled, sending, completed
    scheduled_at = Column(DateTime, nullable=True)
    sent_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
