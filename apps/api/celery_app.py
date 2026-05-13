"""Celery application for background tasks."""

from celery import Celery
from config import settings

celery_app = Celery(
    "jotlayerraid",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,  # One task at a time (API rate limits)
    result_expires=3600 * 24,  # Keep results for 24h
)
