from sqlalchemy import Column, Integer, String
from database import Base


class Font(Base):
    __tablename__ = "fonts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    file_url = Column(String, nullable=False)  # R2 URL to .ttf/.otf
    preview_url = Column(String, nullable=True)
    category = Column(String, default="NFL")  # NFL, MLB, NCAA, NHL, Custom
