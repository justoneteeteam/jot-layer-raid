import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/jotlayerraid"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # AI / DashScope (Qwen)
    QWEN_API_KEY: str = ""  # Also used as DASHSCOPE_API_KEY
    DASHSCOPE_BASE_URL: str = "https://dashscope-intl.aliyuncs.com/api/v1"
    QWEN_VL_MODEL: str = "qwen3-vl-8b-instruct"  # Cheapest VL: $0.18/1M input
    QWEN_IMAGE_EDIT_MODEL: str = "qwen-image-edit-plus"  # $0.03/image

    # Cloudflare R2
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = "jot-layer-raid-bucket"

    # Auth
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    class Config:
        env_file = ".env"


settings = Settings()
