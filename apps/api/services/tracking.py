import os
import hmac
import hashlib
import base64
import logging

logger = logging.getLogger(__name__)

# Standard secret for tracking signatures
TRACKING_SECRET = os.environ.get("TRACKING_SECRET", "JOT_SECURE_TRACKING_SALT_123")

def generate_secure_tracking_link(original_url: str, contact_id: int, campaign_id: int = None, flow_run_id: int = None) -> str:
    """
    Generates a secure redirect link signed with an HMAC signature.
    Prevents open redirect vulnerabilities by validating signatures server-side.
    """
    camp_str = str(campaign_id) if campaign_id else ""
    flow_str = str(flow_run_id) if flow_run_id else ""
    
    # Bundle payloads
    payload = f"{original_url}|{contact_id}|{camp_str}|{flow_str}"
    
    # Calculate HMAC-SHA256 signature
    signature = hmac.new(TRACKING_SECRET.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    
    # Base64 encode the payload to keep URLs URL-safe
    encoded_payload = base64.urlsafe_b64encode(payload.encode("utf-8")).decode("utf-8")
    
    # Return formatted redirect link (point to the JOT Layer Raid API backend)
    # The caller will prefix the server host
    return f"/api/marketing/track/click?p={encoded_payload}&s={signature}"

def verify_tracking_link(encoded_payload: str, signature: str) -> dict:
    """
    Verifies the HMAC signature of the payload.
    Returns the unpacked parameters if authentic, otherwise raises ValueError.
    """
    try:
        decoded_bytes = base64.urlsafe_b64decode(encoded_payload.encode("utf-8"))
        payload = decoded_bytes.decode("utf-8")
    except Exception as e:
        logger.error(f"Failed to decode tracking payload: {e}")
        raise ValueError("Invalid payload encoding")

    # Re-calculate signature
    calculated_sig = hmac.new(TRACKING_SECRET.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    
    if not hmac.compare_digest(calculated_sig, signature):
        logger.warning("HMAC signature verification failed for tracking redirect!")
        raise ValueError("Invalid signature (unauthorized redirect)")

    # Unpack values: original_url, contact_id, campaign_id, flow_run_id
    parts = payload.split("|")
    if len(parts) != 4:
        raise ValueError("Malformatted tracking payload parameters")

    original_url, contact_id_str, campaign_id_str, flow_run_id_str = parts
    
    return {
        "original_url": original_url,
        "contact_id": int(contact_id_str) if contact_id_str else None,
        "campaign_id": int(campaign_id_str) if campaign_id_str else None,
        "flow_run_id": int(flow_run_id_str) if flow_run_id_str else None
    }
