"""add_intake_submissions

Revision ID: c4151ade0694
Revises: 260329c_orders_fulfillment
Create Date: 2026-03-31 12:12:33.706664

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4151ade0694'
down_revision: Union[str, Sequence[str], None] = '260329c_orders_fulfillment'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create intake_submissions privacy vault table."""
    op.create_table(
        'intake_submissions',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('patient_id', sa.Integer(), sa.ForeignKey('patients.id'), nullable=False),
        sa.Column('first_name', sa.String(length=100), nullable=False),
        sa.Column('last_name', sa.String(length=100), nullable=False),
        sa.Column('dob', sa.String(length=20), nullable=False),
        sa.Column('gender', sa.String(length=20), nullable=False),
        sa.Column('phone', sa.String(length=30), nullable=False),
        sa.Column('email', sa.String(length=254), nullable=False),
        sa.Column('address', sa.Text(), nullable=False),
        sa.Column('chief_complaint', sa.Text(), nullable=False),
        sa.Column('symptoms', sa.Text(), nullable=True),
        sa.Column('insurance_provider', sa.String(length=200), nullable=False),
        sa.Column('policy_id', sa.String(length=100), nullable=False),
        sa.Column('emergency_contact_name', sa.String(length=200), nullable=False),
        sa.Column('emergency_contact_relationship', sa.String(length=50), nullable=False),
        sa.Column('emergency_contact_phone', sa.String(length=30), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_intake_submissions_patient_id',
        'intake_submissions',
        ['patient_id'],
        unique=False,
    )


def downgrade() -> None:
    """Drop intake_submissions table."""
    op.drop_index('ix_intake_submissions_patient_id', table_name='intake_submissions')
    op.drop_table('intake_submissions')
