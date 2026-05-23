import sys
from config import settings
from services.r2_storage import get_r2_client

def set_cors():
    try:
        print("Setting CORS on Cloudflare R2 bucket...")
        client = get_r2_client()
        
        cors_configuration = {
            'CORSRules': [
                {
                    'AllowedHeaders': ['*'],
                    'AllowedMethods': ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
                    'AllowedOrigins': ['*'],
                    'ExposeHeaders': ['ETag', 'Content-Type'],
                    'MaxAgeSeconds': 3000
                }
            ]
        }
        
        client.put_bucket_cors(
            Bucket=settings.R2_BUCKET_NAME,
            CORSConfiguration=cors_configuration
        )
        print(f"Success! CORS configuration applied successfully to R2 bucket '{settings.R2_BUCKET_NAME}'.")
    except Exception as e:
        print(f"Error applying CORS to R2: {e}")
        sys.exit(1)

if __name__ == "__main__":
    set_cors()
