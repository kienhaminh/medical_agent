"""add urgency_level to visits

Revision ID: 260329_visits_urgency
Revises: 260328_visits_doctor_fields
Create Date: 2026-03-29
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '260329_visits_urgency'
down_revision: Union[str, Sequence[str], None] = '260328_visits_doctor_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('visits', sa.Column('urgency_level', sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column('visits', 'urgency_level')
