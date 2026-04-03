# alembic/versions/005_room_visit_unique.py
"""Add unique constraint on rooms.current_visit_id.

Revision ID: 005_room_visit_unique
Revises: 004_add_rooms
Create Date: 2026-04-03
"""
from alembic import op

revision = "005_room_visit_unique"
down_revision = "004_add_rooms"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "uq_rooms_current_visit_id",
        "rooms",
        ["current_visit_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_rooms_current_visit_id", table_name="rooms")
