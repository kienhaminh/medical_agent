"""add clinical_notes and assigned_doctor to visits

Revision ID: 260328_add_doctor_fields_to_visits
Revises: 260327_fix_users_schema
Create Date: 2026-03-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '260328_visits_doctor_fields'
down_revision: Union[str, Sequence[str], None] = '260327_fix_users_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('visits', sa.Column('clinical_notes', sa.Text(), nullable=True))
    op.add_column('visits', sa.Column('assigned_doctor', sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column('visits', 'assigned_doctor')
    op.drop_column('visits', 'clinical_notes')
