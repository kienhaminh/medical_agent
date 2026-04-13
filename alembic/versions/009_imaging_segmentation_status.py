"""Add segmentation_status to imaging

Revision ID: 009
Revises: 008
Create Date: 2026-04-13
"""
from alembic import op
import sqlalchemy as sa

revision = "009_imaging_segmentation_status"
down_revision = "008_intake_phone_nullable"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "imaging",
        sa.Column("segmentation_status", sa.String(20), nullable=False, server_default="idle"),
    )


def downgrade() -> None:
    op.drop_column("imaging", "segmentation_status")
