from sqlalchemy import Column, Integer, String, ForeignKey, JSON
from sqlalchemy.orm import relationship
from database import Base


class MockupTemplate(Base):
    __tablename__ = "mockup_templates"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    name = Column(String, nullable=False)
    color_variant = Column(String, nullable=True)
    original_image_url = Column(String, nullable=True)  # Raw uploaded image
    
    font_config = Column(JSON, default=lambda: {
        "font_id": None, "size": 60, "color": "#FFFFFF", "outline_color": "#000000", "outline_width": 2
    })
    
    canvas_json = Column(JSON, nullable=True)  # Full Fabric.js state
    background_color = Column(String, default="#e5e7eb")

    team = relationship("Team", back_populates="mockup_templates")
