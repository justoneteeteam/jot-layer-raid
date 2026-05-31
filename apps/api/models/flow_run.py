from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from database import Base
from datetime import datetime, timezone

class FlowRun(Base):
    __tablename__ = "flow_runs"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(String, index=True, nullable=False)
    flow_id = Column(Integer, ForeignKey("automation_flows.id"), nullable=False)
    flow_version = Column(Integer, nullable=False)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=False)
    status = Column(String, default="active") # active, waiting, completed, cancelled
    current_node_id = Column(String, nullable=True)
    variables_json = Column(Text, nullable=True)
    next_execution_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    idempotency_key = Column(String, unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
