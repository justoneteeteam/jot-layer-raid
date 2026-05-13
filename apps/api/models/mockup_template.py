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
    blank_image_url = Column(String, nullable=True)  # Text-removed blank
    name_layer_url = Column(String, nullable=True)  # Name layer PNG
    number_layer_url = Column(String, nullable=True)  # Number layer PNG
    text_positions = Column(JSON, default=lambda: {
        "name": {"x": 0.5, "y": 0.15},
        "number": {"x": 0.5, "y": 0.30}
    })
    font_config = Column(JSON, default=lambda: {
        "font_id": None, "size": 60, "color": "#FFFFFF", "outline_color": "#000000", "outline_width": 2
    })
    separation_status = Column(String, default="pending")  # pending, processing, done, failed

    team = relationship("Team", back_populates="mockup_templates")
