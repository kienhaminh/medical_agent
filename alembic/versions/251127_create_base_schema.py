"""create base schema

Revision ID: 251127_create_base_schema
Revises: 
Create Date: 2025-11-27 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector


# revision identifiers, used by Alembic.
revision = "251127_create_base_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "patients",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("dob", sa.String(length=20), nullable=False),
        sa.Column("gender", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("health_summary", sa.Text(), nullable=True),
        sa.Column("health_summary_updated_at", sa.DateTime(), nullable=True),
        sa.Column("health_summary_status", sa.String(length=20), nullable=True),
        sa.Column("health_summary_task_id", sa.String(length=100), nullable=True),
        sa.Column("embedding", Vector(768), nullable=True),
    )

    op.create_table(
        "medical_records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("patient_id", sa.Integer(), nullable=False),
        sa.Column("record_type", sa.String(length=50), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("embedding", Vector(768), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], ),
    )

    op.create_table(
        "image_groups",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("patient_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"]),
    )

    op.create_table(
        "sub_agents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False, unique=True),
        sa.Column("role", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("system_prompt", sa.Text(), nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("color", sa.String(length=20), nullable=False),
        sa.Column("icon", sa.String(length=50), nullable=False),
        sa.Column("is_template", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("parent_template_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            server_onupdate=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["parent_template_id"], ["sub_agents.id"]),
    )

    op.create_table(
        "imaging",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("patient_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("image_type", sa.String(length=50), nullable=False),
        sa.Column("original_url", sa.Text(), nullable=False),
        sa.Column("preview_url", sa.Text(), nullable=False),
        sa.Column("group_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["group_id"], ["image_groups.id"]),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"]),
    )

    op.create_table(
        "tools",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False, unique=True),
        sa.Column("symbol", sa.String(length=100), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("tool_type", sa.String(length=20), server_default=sa.text("'function'"), nullable=False),
        sa.Column("code", sa.Text(), nullable=True),
        sa.Column("api_endpoint", sa.String(length=500), nullable=True),
        sa.Column("api_request_payload", sa.Text(), nullable=True),
        sa.Column("api_request_example", sa.Text(), nullable=True),
        sa.Column("api_response_payload", sa.Text(), nullable=True),
        sa.Column("api_response_example", sa.Text(), nullable=True),
        sa.Column("scope", sa.String(length=20), server_default=sa.text("'global'"), nullable=False),
        sa.Column("assigned_agent_id", sa.Integer(), nullable=True),
        sa.Column("enabled", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("test_passed", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["assigned_agent_id"], ["sub_agents.id"]),
    )

    op.create_table(
        "chat_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("agent_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            server_onupdate=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["agent_id"], ["sub_agents.id"]),
    )

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("tool_calls", sa.Text(), nullable=True),
        sa.Column("reasoning", sa.Text(), nullable=True),
        sa.Column("patient_references", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("status", sa.String(length=20), server_default=sa.text("'completed'"), nullable=False),
        sa.Column("task_id", sa.String(length=100), nullable=True),
        sa.Column("logs", sa.Text(), nullable=True),
        sa.Column("streaming_started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("token_usage", sa.Text(), nullable=True),
        sa.Column(
            "last_updated_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            server_onupdate=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["session_id"], ["chat_sessions.id"], ondelete="CASCADE"),
    )


def downgrade() -> None:
    op.drop_table("chat_messages")
    op.drop_table("chat_sessions")
    op.drop_table("tools")
    op.drop_table("imaging")
    op.drop_table("sub_agents")
    op.drop_table("image_groups")
    op.drop_table("medical_records")
    op.drop_table("patients")
    op.execute("DROP EXTENSION IF EXISTS vector")
