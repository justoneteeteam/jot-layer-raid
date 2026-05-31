from sqlalchemy import Column, Integer, String, DateTime
from database import Base
from datetime import datetime, timezone

class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(String, index=True, nullable=False)
    email = Column(String, index=True, nullable=False)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    consent_status = Column(String, default="subscribed") # subscribed, unsubscribed, transactional_only
    consent_source = Column(String, nullable=True) # checkout_opt_in, popup, csv_import
    unsubscribed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
