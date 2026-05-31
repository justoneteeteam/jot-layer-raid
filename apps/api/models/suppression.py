from sqlalchemy import Column, Integer, String, DateTime
from database import Base
from datetime import datetime, timezone

class Suppression(Base):
    __tablename__ = "suppressions"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(String, index=True, nullable=False)
    email = Column(String, index=True, nullable=False)
    reason = Column(String, nullable=False) # bounce, complaint, unsubscribe, manual
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
