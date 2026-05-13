from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime, timezone


class RosterChange(Base):
    __tablename__ = "roster_changes"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    player_name = Column(String, nullable=False)
    player_number = Column(Integer, nullable=False)
    change_type = Column(String, nullable=False)  # new, updated, removed
    source = Column(String, default="csv")  # csv, yahoo
    status = Column(String, default="pending")  # pending, approved, rejected
    diff_data = Column(JSON, nullable=True)
    detected_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    team = relationship("Team", back_populates="roster_changes")
