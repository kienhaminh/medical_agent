"""add imaging group id

Revision ID: 251126_add_imaging_group_id
Revises: 251126_add_id_to_tools
Create Date: 2025-11-26

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '251126_add_imaging_group_id'
down_revision: Union[str, None] = '251126_add_id_to_tools'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: Add group_id to imaging table."""
    # Add group_id column
    op.add_column('imaging', sa.Column('group_id', sa.Integer(), nullable=True))
    
    # Add foreign key constraint
    op.create_foreign_key(
        'fk_imaging_group_id_image_groups',
        'imaging', 'image_groups',
        ['group_id'], ['id']
    )


def downgrade() -> None:
    """Downgrade schema: Remove group_id from imaging table."""
    # Drop foreign key
    op.drop_constraint('fk_imaging_group_id_image_groups', 'imaging', type_='foreignkey')
    
    # Drop column
    op.drop_column('imaging', 'group_id')
