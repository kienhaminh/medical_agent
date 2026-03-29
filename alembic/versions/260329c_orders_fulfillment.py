"""add result_notes and fulfilled_by to orders

Revision ID: 260329c_orders_fulfillment
Revises: 260329b_create_orders
Create Date: 2026-03-29
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '260329c_orders_fulfillment'
down_revision: Union[str, Sequence[str], None] = '260329b_create_orders'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('orders', sa.Column('result_notes', sa.Text(), nullable=True))
    op.add_column('orders', sa.Column('fulfilled_by', sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column('orders', 'fulfilled_by')
    op.drop_column('orders', 'result_notes')
