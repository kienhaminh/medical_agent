"""merge multiple heads

Revision ID: 412ff87d3456
Revises: 260322_add_fk_indexes, 251126_add_imaging_group_id, 251127_create_base_schema
Create Date: 2026-03-24 16:27:11.443440

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '412ff87d3456'
down_revision: Union[str, Sequence[str], None] = ('260322_add_fk_indexes', '251126_add_imaging_group_id', '251127_create_base_schema')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
