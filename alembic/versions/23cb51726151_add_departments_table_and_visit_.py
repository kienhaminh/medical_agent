"""add departments table and visit department fields

Revision ID: 23cb51726151
Revises: a9fbf718e9f3
Create Date: 2026-03-25 11:12:51.699987

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '23cb51726151'
down_revision: Union[str, Sequence[str], None] = 'a9fbf718e9f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('visits', sa.Column('current_department', sa.String(length=50), nullable=True))
    op.add_column('visits', sa.Column('queue_position', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_visits_current_department', 'visits', 'departments', ['current_department'], ['name'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_visits_current_department', 'visits', type_='foreignkey')
    op.drop_column('visits', 'queue_position')
    op.drop_column('visits', 'current_department')
