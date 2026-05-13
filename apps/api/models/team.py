from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    league_id = Column(Integer, ForeignKey("leagues.id"), nullable=False)
    name = Column(String, nullable=False)
    region = Column(String, nullable=True)  # NFC East, AFC North, etc.
    slug = Column(String, nullable=False, unique=True)
    primary_color = Column(String, nullable=True)
    secondary_color = Column(String, nullable=True)
    logo_url = Column(String, nullable=True)
    yahoo_roster_url = Column(String, nullable=True)

    league = relationship("League", back_populates="teams")
    players = relationship("Player", back_populates="team")
    mockup_templates = relationship("MockupTemplate", back_populates="team")
    roster_changes = relationship("RosterChange", back_populates="team")
