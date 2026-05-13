from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from database import Base


class League(Base):
    __tablename__ = "leagues"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)  # NFL, MLB, NCAA, NHL
    slug = Column(String, nullable=False, unique=True)
    logo_url = Column(String, nullable=True)

    teams = relationship("Team", back_populates="league")
