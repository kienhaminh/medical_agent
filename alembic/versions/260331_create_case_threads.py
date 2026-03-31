"""create_case_threads

Revision ID: 260331_create_case_threads
Revises: c4151ade0694
Create Date: 2026-03-31

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '260331_create_case_threads'
down_revision: Union[str, Sequence[str], None] = 'c4151ade0694'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create case_threads and case_messages tables."""
    op.create_table(
        'case_threads',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('patient_id', sa.Integer(), sa.ForeignKey('patients.id'), nullable=False),
        sa.Column('visit_id', sa.Integer(), sa.ForeignKey('visits.id'), nullable=True),
        sa.Column('created_by', sa.String(length=100), nullable=False),
        sa.Column('trigger', sa.String(length=20), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='open'),
        sa.Column('max_rounds', sa.Integer(), nullable=False, server_default='3'),
        sa.Column('current_round', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('case_summary', sa.Text(), nullable=False),
        sa.Column('synthesis', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_case_threads_patient_id', 'case_threads', ['patient_id'], unique=False)
    op.create_index('ix_case_threads_visit_id', 'case_threads', ['visit_id'], unique=False)

    op.create_table(
        'case_messages',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('thread_id', sa.String(length=36),
                  sa.ForeignKey('case_threads.id', ondelete='CASCADE'), nullable=False),
        sa.Column('round', sa.Integer(), nullable=False),
        sa.Column('sender_type', sa.String(length=20), nullable=False),
        sa.Column('specialist_role', sa.String(length=50), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('agrees_with', sa.JSON(), nullable=True),
        sa.Column('challenges', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_case_messages_thread_id', 'case_messages', ['thread_id'], unique=False)


def downgrade() -> None:
    """Drop case_messages then case_threads."""
    op.drop_index('ix_case_messages_thread_id', table_name='case_messages')
    op.drop_table('case_messages')
    op.drop_index('ix_case_threads_visit_id', table_name='case_threads')
    op.drop_index('ix_case_threads_patient_id', table_name='case_threads')
    op.drop_table('case_threads')
