"""create orders table

Revision ID: 260329b_create_orders
Revises: 260329_visits_urgency
Create Date: 2026-03-29
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '260329b_create_orders'
down_revision: Union[str, Sequence[str], None] = '260329_visits_urgency'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_table(
        'orders',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('visit_id', sa.Integer(), sa.ForeignKey('visits.id'), nullable=False),
        sa.Column('patient_id', sa.Integer(), sa.ForeignKey('patients.id'), nullable=False),
        sa.Column('order_type', sa.String(20), nullable=False),
        sa.Column('order_name', sa.String(200), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('ordered_by', sa.String(200), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_orders_visit_id', 'orders', ['visit_id'])
    op.create_index('ix_orders_patient_id', 'orders', ['patient_id'])

def downgrade() -> None:
    op.drop_index('ix_orders_patient_id', 'orders')
    op.drop_index('ix_orders_visit_id', 'orders')
    op.drop_table('orders')
