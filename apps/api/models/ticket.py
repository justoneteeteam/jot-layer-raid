from sqlalchemy import Column, Integer, String, Text, DateTime
from database import Base
from datetime import datetime, timezone


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    customer_name = Column(String, nullable=False, index=True)
    customer_email = Column(String, nullable=False, index=True)
    subject = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String, default="open")  # open, pending, resolved, spam, snoozed
    replies = Column(Text, default="[]")  # Serialized JSON list of replies
    recipient_email = Column(String, nullable=True, index=True)
    tags = Column(String, default="")  # e.g., "spam", "marketing"
    snoozed_until = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
