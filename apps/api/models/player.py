from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


class Player(Base):
    __tablename__ = "players"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    name = Column(String, nullable=False)
    display_name = Column(String, nullable=False)  # Uppercase version for jersey
    number = Column(Integer, nullable=False)
    type = Column(String, default="Current")  # Current, Legend, Custom
    group = Column(String, default="Football")
    is_active = Column(Boolean, default=True)

    team = relationship("Team", back_populates="players")
