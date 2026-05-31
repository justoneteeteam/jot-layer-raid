from sqlalchemy import Column, Integer, String, DateTime, Boolean
from database import Base
from datetime import datetime, timezone

class EmailSenderIdentity(Base):
    __tablename__ = "email_sender_identities"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(String, index=True, nullable=False)
    provider = Column(String, nullable=False) # cloudflare, resend, ses, smtp
    from_name = Column(String, nullable=False)
    from_email = Column(String, nullable=False, index=True)
    reply_to_email = Column(String, nullable=True)
    domain = Column(String, index=True, nullable=False)
    status = Column(String, default="pending") # pending, verified, active, disabled
    provider_config_ref = Column(String, nullable=True) # encrypted/reference to API token
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
