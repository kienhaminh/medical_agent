"""add_patient_health_summary

Revision ID: 251125_health_summary
Revises: e8bd8fafd784
Create Date: 2025-11-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '251125_health_summary'
down_revision: Union[str, Sequence[str], None] = 'e8bd8fafd784'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add health_summary fields to patients table."""
    op.add_column('patients', sa.Column('health_summary', sa.Text(), nullable=True))
    op.add_column('patients', sa.Column('health_summary_updated_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Remove health_summary fields from patients table."""
    op.drop_column('patients', 'health_summary_updated_at')
    op.drop_column('patients', 'health_summary')

