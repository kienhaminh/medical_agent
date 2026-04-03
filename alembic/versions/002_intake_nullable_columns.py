"""Make optional intake_submissions columns nullable.

Revision ID: 002_intake_nullable_columns
Revises: 001_init
Create Date: 2026-04-03
"""
from alembic import op
import sqlalchemy as sa

revision = "002_intake_nullable_columns"
down_revision = "001_init"
branch_labels = None
depends_on = None

# Columns that should be nullable but were created NOT NULL
_NULLABLE_COLUMNS = [
    ("email", sa.String(254)),
    ("address", sa.Text()),
    ("insurance_provider", sa.String(200)),
    ("policy_id", sa.String(100)),
    ("emergency_contact_name", sa.String(200)),
    ("emergency_contact_relationship", sa.String(50)),
    ("emergency_contact_phone", sa.String(30)),
]


def upgrade() -> None:
    for col_name, col_type in _NULLABLE_COLUMNS:
        op.alter_column(
            "intake_submissions",
            col_name,
            existing_type=col_type,
            nullable=True,
        )


def downgrade() -> None:
    for col_name, col_type in _NULLABLE_COLUMNS:
        op.alter_column(
            "intake_submissions",
            col_name,
            existing_type=col_type,
            nullable=False,
        )
