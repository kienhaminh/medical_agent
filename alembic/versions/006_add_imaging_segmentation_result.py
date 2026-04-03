"""Add segmentation_result column to imaging table.

Revision ID: a1b2c3d4e5f6
Revises: 79635e5d05b8
Create Date: 2026-04-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "a1b2c3d4e5f6"
down_revision = "79635e5d05b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "imaging",
        sa.Column("segmentation_result", JSONB, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("imaging", "segmentation_result")
