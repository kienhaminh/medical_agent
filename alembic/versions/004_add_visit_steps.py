"""Add visit_steps table.

Revision ID: 004_add_visit_steps
Revises: 003_drop_unused_intake_columns
Create Date: 2026-04-03
"""
from alembic import op
import sqlalchemy as sa

revision = "004_add_visit_steps"
down_revision = "003_drop_unused_intake_columns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "visit_steps",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("visit_id", sa.Integer(), sa.ForeignKey("visits.id"), nullable=False, index=True),
        sa.Column("step_order", sa.Integer(), nullable=False),
        sa.Column("department", sa.String(50), sa.ForeignKey("departments.name"), nullable=True),
        sa.Column("label", sa.String(200), nullable=False),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("room", sa.String(100), nullable=True),
        sa.Column(
            "status",
            sa.Enum("pending", "active", "done", name="stepstatus"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("visit_steps")
    op.execute("DROP TYPE IF EXISTS stepstatus")
