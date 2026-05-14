"""Background tasks for bulk processing."""

import logging
from celery_app import celery_app
from database import SessionLocal

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="tasks.run_bulk_job")
def run_bulk_job(self, bulk_job_id: int):
    """
    Celery task: Run a bulk generation job.
    Placeholder for future implementation.
    """
    pass
