"""Create skill tables

Revision ID: 001_create_skill_tables
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_create_skill_tables'
down_revision = '85a636c209d2'
branch_labels = None
depends_on = None


def upgrade():
    # Create skills table
    op.create_table(
        'skills',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False, unique=True),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('when_to_use', postgresql.JSONB(), nullable=True),
        sa.Column('when_not_to_use', postgresql.JSONB(), nullable=True),
        sa.Column('keywords', postgresql.JSONB(), nullable=True),
        sa.Column('examples', postgresql.JSONB(), nullable=True),
        sa.Column('source_type', sa.String(20), nullable=False, server_default='database'),
        sa.Column('source_path', sa.String(500), nullable=True),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('version', sa.String(20), nullable=False, server_default='1.0.0'),
        sa.Column('is_system', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('last_loaded_at', sa.DateTime(), nullable=True),
        sa.Column('file_hash', sa.String(64), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_skills_name', 'skills', ['name'], unique=True)
    
    # Create skill_tools table
    op.create_table(
        'skill_tools',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('skill_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('implementation_type', sa.String(20), nullable=False, server_default='code'),
        sa.Column('code', sa.Text(), nullable=True),
        sa.Column('config', postgresql.JSONB(), nullable=True),
        sa.Column('parameters_schema', postgresql.JSONB(), nullable=True),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.ForeignKeyConstraint(['skill_id'], ['skills.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_skill_tools_skill_id', 'skill_tools', ['skill_id'])
    
    # Create agent_skills association table
    op.create_table(
        'agent_skills',
        sa.Column('agent_id', sa.Integer(), nullable=False),
        sa.Column('skill_id', sa.Integer(), nullable=False),
        sa.Column('assigned_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('config', postgresql.JSONB(), nullable=True),
        sa.ForeignKeyConstraint(['agent_id'], ['sub_agents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['skill_id'], ['skills.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('agent_id', 'skill_id')
    )


def downgrade():
    op.drop_table('agent_skills')
    op.drop_table('skill_tools')
    op.drop_table('skills')
