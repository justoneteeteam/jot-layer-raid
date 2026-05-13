"""Background tasks for jersey separation and bulk processing."""

import logging
from celery_app import celery_app
from database import SessionLocal
from models.mockup_template import MockupTemplate
from services.qwen_separator import separate_jersey
from services.r2_storage import get_presigned_url

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="tasks.run_separation")
def run_separation(self, mockup_template_id: int, image_key: str):
    """
    Celery task: Run the hybrid separation pipeline on a jersey image.
    
    Updates the MockupTemplate record with layer URLs and status as it progresses.
    """
    db = SessionLocal()
    try:
        template = db.query(MockupTemplate).filter(MockupTemplate.id == mockup_template_id).first()
        if not template:
            logger.error(f"MockupTemplate {mockup_template_id} not found")
            return {"error": "Template not found"}

        # Update status
        template.separation_status = "processing"
        db.commit()

        # Progress callback to update task state
        def on_progress(step: str, message: str):
            self.update_state(
                state="PROGRESS",
                meta={"step": step, "message": message}
            )
            # Also update DB status
            template.separation_status = step
            db.commit()

        # Download the original image from R2
        from services.r2_storage import get_r2_client
        from config import settings

        client = get_r2_client()
        response = client.get_object(
            Bucket=settings.R2_BUCKET_NAME,
            Key=image_key,
        )
        image_bytes = response["Body"].read()

        # Run the pipeline
        result = separate_jersey(
            image_bytes=image_bytes,
            r2_prefix=f"mockups/{mockup_template_id}",
            job_id=str(mockup_template_id),
            progress_callback=on_progress,
        )

        if result.error:
            template.separation_status = "failed"
            db.commit()
            return {"error": result.error}

        # Update template with results
        template.blank_image_url = result.blank_jersey_key
        template.name_layer_url = result.name_layer_key
        template.number_layer_url = result.number_layer_key
        template.text_positions = result.text_positions
        template.separation_status = "done"
        db.commit()

        return {
            "status": "done",
            "blank_key": result.blank_jersey_key,
            "name_key": result.name_layer_key,
            "number_key": result.number_layer_key,
            "text_positions": result.text_positions,
            "cost_cents": result.cost_cents,
        }

    except Exception as e:
        logger.exception(f"Separation task failed: {e}")
        if template:
            template.separation_status = "failed"
            db.commit()
        return {"error": str(e)}
    finally:
        db.close()
