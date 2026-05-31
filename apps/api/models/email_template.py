from sqlalchemy import Column, Integer, String, Text, DateTime
from database import Base
from datetime import datetime, timezone

class EmailTemplate(Base):
    __tablename__ = "email_templates"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(String, index=True, nullable=False)
    name = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    body_html = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
