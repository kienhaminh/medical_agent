"""Add rooms table.

Revision ID: 004_add_rooms
Revises: 003_drop_unused_intake_columns
Create Date: 2026-04-03
"""
from alembic import op
import sqlalchemy as sa

revision = "004_add_rooms"
down_revision = "003_drop_unused_intake_columns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "rooms",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("room_number", sa.String(20), nullable=False, unique=True),
        sa.Column("department_name", sa.String(50), sa.ForeignKey("departments.name"), nullable=False),
        sa.Column("current_visit_id", sa.Integer(), sa.ForeignKey("visits.id"), nullable=True),
    )
    op.create_index("ix_rooms_room_number", "rooms", ["room_number"], unique=True)
    op.create_index("ix_rooms_department_name", "rooms", ["department_name"])


def downgrade() -> None:
    op.drop_index("ix_rooms_department_name", table_name="rooms")
    op.drop_index("ix_rooms_room_number", table_name="rooms")
    op.drop_table("rooms")
