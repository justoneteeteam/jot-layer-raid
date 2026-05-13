from sqlalchemy import Column, Integer, String
from database import Base


class Patch(Base):
    __tablename__ = "patches"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    image_url = Column(String, nullable=False)  # R2 URL to transparent PNG
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
