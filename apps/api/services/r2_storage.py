import boto3
from config import settings


def get_r2_client():
    return boto3.client(
        service_name="s3",
        endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto",
    )


def upload_file_to_r2(key: str, data: bytes, content_type: str = "image/png") -> str:
    """Upload bytes to R2 and return the key."""
    client = get_r2_client()
    client.put_object(
        Bucket=settings.R2_BUCKET_NAME,
        Key=key,
        Body=data,
        ContentType=content_type,
    )
    return key


def get_presigned_url(key: str, expiration: int = 3600) -> str:
    """Generate a presigned URL for downloading a file from R2."""
    client = get_r2_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.R2_BUCKET_NAME, "Key": key},
        ExpiresIn=expiration,
    )


def get_presigned_upload_url(key: str, content_type: str = "image/png", expiration: int = 3600) -> str:
    """Generate a presigned URL for uploading a file to R2."""
    client = get_r2_client()
    return client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.R2_BUCKET_NAME,
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=expiration,
    )
