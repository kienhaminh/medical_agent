"""drop_sub_agents_add_agent_role

Revision ID: 00a5b9fa67ca
Revises: 260331_create_case_threads
Create Date: 2026-04-01 01:31:16.644189

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '00a5b9fa67ca'
down_revision: Union[str, Sequence[str], None] = '260331_create_case_threads'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add agent_role to chat_sessions
    op.add_column('chat_sessions', sa.Column('agent_role', sa.String(length=100), nullable=True))

    # 2. Migrate existing data: populate agent_role from sub_agents
    op.execute("""
        UPDATE chat_sessions
        SET agent_role = (
            SELECT role FROM sub_agents WHERE sub_agents.id = chat_sessions.agent_id
        )
        WHERE agent_id IS NOT NULL
    """)

    # 3. Drop agent_id from chat_sessions (drops FK constraint with it)
    op.drop_column('chat_sessions', 'agent_id')

    # 4. Drop assigned_agent_id from tools (drops FK constraint with it)
    op.drop_column('tools', 'assigned_agent_id')

    # 5. Drop agent_skills table
    op.drop_table('agent_skills')

    # 6. Drop sub_agents table
    op.drop_table('sub_agents')


def downgrade() -> None:
    # Recreate sub_agents
    op.create_table(
        'sub_agents',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('role', sa.String(50), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('system_prompt', sa.Text(), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('color', sa.String(20), nullable=False),
        sa.Column('icon', sa.String(50), nullable=False),
        sa.Column('is_template', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('parent_template_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['parent_template_id'], ['sub_agents.id']),
        sa.UniqueConstraint('name'),
    )
    # Recreate agent_skills
    op.create_table(
        'agent_skills',
        sa.Column('agent_id', sa.Integer(), nullable=False),
        sa.Column('skill_id', sa.Integer(), nullable=False),
        sa.Column('assigned_at', sa.DateTime(), nullable=False),
        sa.Column('config', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['agent_id'], ['sub_agents.id']),
        sa.ForeignKeyConstraint(['skill_id'], ['skills.id']),
        sa.PrimaryKeyConstraint('agent_id', 'skill_id'),
    )
    # Restore assigned_agent_id on tools
    op.add_column('tools', sa.Column('assigned_agent_id', sa.Integer(), nullable=True))
    op.create_foreign_key(None, 'tools', 'sub_agents', ['assigned_agent_id'], ['id'])
    # Restore agent_id on chat_sessions
    op.add_column('chat_sessions', sa.Column('agent_id', sa.Integer(), nullable=True))
    op.create_foreign_key(None, 'chat_sessions', 'sub_agents', ['agent_id'], ['id'])
    # Drop agent_role from chat_sessions
    op.drop_column('chat_sessions', 'agent_role')
