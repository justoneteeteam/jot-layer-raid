from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime, timezone


class BulkJob(Base):
    __tablename__ = "bulk_jobs"

    id = Column(Integer, primary_key=True, index=True)
    status = Column(String, default="pending")  # pending, running, completed, failed
    total_items = Column(Integer, default=0)
    completed_items = Column(Integer, default=0)
    failed_items = Column(Integer, default=0)
    store_targets = Column(JSON, default=list)  # [{store_id, platform}]
    seo_template = Column(JSON, default=dict)  # {title_pattern, description_pattern, category_pattern}
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)

    items = relationship("BulkJobItem", back_populates="job")


class BulkJobItem(Base):
    __tablename__ = "bulk_job_items"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("bulk_jobs.id"), nullable=False)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    mockup_template_id = Column(Integer, ForeignKey("mockup_templates.id"), nullable=False)
    gender = Column(String, nullable=False)  # Men, Women, Youth
    color = Column(String, nullable=True)
    status = Column(String, default="pending")  # pending, generating, uploading, done, failed
    generated_image_url = Column(String, nullable=True)
    product_title = Column(String, nullable=True)
    product_description = Column(String, nullable=True)
    product_category = Column(String, nullable=True)
    store_product_ids = Column(JSON, default=dict)  # {store_id: product_id}
    error_message = Column(String, nullable=True)

    job = relationship("BulkJob", back_populates="items")
