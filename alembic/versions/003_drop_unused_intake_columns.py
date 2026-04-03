"""Drop unused optional columns from intake_submissions.

Revision ID: 003_drop_unused_intake_columns
Revises: 002_intake_nullable_columns
Create Date: 2026-04-03
"""
from alembic import op
import sqlalchemy as sa

revision = "003_drop_unused_intake_columns"
down_revision = "002_intake_nullable_columns"
branch_labels = None
depends_on = None

_DROP_COLUMNS = [
    ("email", sa.String(254)),
    ("address", sa.Text()),
    ("insurance_provider", sa.String(200)),
    ("policy_id", sa.String(100)),
    ("emergency_contact_name", sa.String(200)),
    ("emergency_contact_relationship", sa.String(50)),
    ("emergency_contact_phone", sa.String(30)),
]


def upgrade() -> None:
    for col_name, _ in _DROP_COLUMNS:
        op.drop_column("intake_submissions", col_name)


def downgrade() -> None:
    for col_name, col_type in reversed(_DROP_COLUMNS):
        op.add_column("intake_submissions", sa.Column(col_name, col_type, nullable=True))
