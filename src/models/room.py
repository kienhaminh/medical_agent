"""Room model — one clinical exam room per row, one patient at a time."""
from sqlalchemy import Column, Integer, String, ForeignKey
from .base import Base


class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, autoincrement=True)
    room_number = Column(String(20), unique=True, nullable=False, index=True)
    department_name = Column(String(50), ForeignKey("departments.name"), nullable=False, index=True)
    current_visit_id = Column(Integer, ForeignKey("visits.id"), nullable=True)
