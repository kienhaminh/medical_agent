"""make intake_submissions.phone nullable

Phone is no longer collected during intake.

Revision ID: 008_intake_phone_nullable
Revises: d56820a667f0
Create Date: 2026-04-13

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '008_intake_phone_nullable'
down_revision: Union[str, Sequence[str], None] = 'd56820a667f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        'intake_submissions', 'phone',
        existing_type=sa.String(30),
        nullable=True,
    )


def downgrade() -> None:
    # Restore empty strings for any NULL rows before re-adding NOT NULL.
    op.execute("UPDATE intake_submissions SET phone = '' WHERE phone IS NULL")
    op.alter_column(
        'intake_submissions', 'phone',
        existing_type=sa.String(30),
        nullable=False,
    )
