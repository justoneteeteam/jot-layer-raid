from sqlalchemy import Column, Integer, String, Text, DateTime
from database import Base
from datetime import datetime, timezone

class AudienceSegment(Base):
    __tablename__ = "audience_segments"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(String, index=True, nullable=False)
    name = Column(String, nullable=False)
    definition_json = Column(Text, nullable=False) # Store dynamic filters as JSON string
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
