"""add id to tools

Revision ID: 251126_add_id_to_tools
Revises: 251125_add_patient_health_summary
Create Date: 2025-11-26

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '251126_add_id_to_tools'
down_revision: Union[str, None] = '85a636c209d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: Add id column to tools and change primary key."""
    # Step 1: Add id column (nullable first)
    op.add_column('tools', sa.Column('id', sa.Integer(), nullable=True))
    
    # Step 2: Populate id values with sequence
    op.execute("""
        CREATE SEQUENCE IF NOT EXISTS tools_id_seq;
        UPDATE tools SET id = nextval('tools_id_seq');
        ALTER SEQUENCE tools_id_seq OWNED BY tools.id;
    """)
    
    # Step 3: Make id NOT NULL
    op.alter_column('tools', 'id', nullable=False)
    
    # Step 4: Drop the old primary key constraint on name
    op.drop_constraint('tools_pkey', 'tools', type_='primary')
    
    # Step 5: Create new primary key on id
    op.create_primary_key('tools_pkey', 'tools', ['id'])
    
    # Step 6: Make name unique (if not already)
    op.create_unique_constraint('tools_name_key', 'tools', ['name'])


def downgrade() -> None:
    """Downgrade schema: Revert to name as primary key."""
    # Step 1: Drop unique constraint on name
    op.drop_constraint('tools_name_key', 'tools', type_='unique')
    
    # Step 2: Drop primary key on id
    op.drop_constraint('tools_pkey', 'tools', type_='primary')
    
    # Step 3: Create primary key on name
    op.create_primary_key('tools_pkey', 'tools', ['name'])
    
    # Step 4: Drop id column
    op.drop_column('tools', 'id')
    
    # Step 5: Drop sequence
    op.execute('DROP SEQUENCE IF EXISTS tools_id_seq')
