"""Initial schema.

Revision ID: 001_init
Revises:
Create Date: 2026-04-02
"""
from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic
revision = "001_init"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "patients",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("dob", sa.Date(), nullable=False),
        sa.Column("gender", sa.String(20), nullable=False),
        sa.Column("health_summary", sa.Text(), nullable=True),
        sa.Column("health_summary_updated_at", sa.DateTime(), nullable=True),
        sa.Column("health_summary_status", sa.String(20), nullable=True),
        sa.Column("health_summary_task_id", sa.String(100), nullable=True),
        sa.Column("embedding", Vector(768), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "intake_submissions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patients.id"), nullable=False),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("dob", sa.String(20), nullable=False),
        sa.Column("gender", sa.String(20), nullable=False),
        sa.Column("phone", sa.String(30), nullable=False),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("address", sa.Text(), nullable=False),
        sa.Column("chief_complaint", sa.Text(), nullable=False),
        sa.Column("symptoms", sa.Text(), nullable=True),
        sa.Column("insurance_provider", sa.String(200), nullable=False),
        sa.Column("policy_id", sa.String(100), nullable=False),
        sa.Column("emergency_contact_name", sa.String(200), nullable=False),
        sa.Column("emergency_contact_relationship", sa.String(50), nullable=False),
        sa.Column("emergency_contact_phone", sa.String(30), nullable=False),
        sa.Column("extra_data", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_intake_submissions_patient_id", "intake_submissions", ["patient_id"])

    op.create_table(
        "medical_records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patients.id"), nullable=False),
        sa.Column("record_type", sa.String(50), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("embedding", Vector(768), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_medical_records_patient_id", "medical_records", ["patient_id"])

    op.create_table(
        "image_groups",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patients.id"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_image_groups_patient_id", "image_groups", ["patient_id"])

    op.create_table(
        "imaging",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patients.id"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("image_type", sa.String(50), nullable=False),
        sa.Column("original_url", sa.Text(), nullable=False),
        sa.Column("preview_url", sa.Text(), nullable=False),
        sa.Column("group_id", sa.Integer(), sa.ForeignKey("image_groups.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_imaging_patient_id", "imaging", ["patient_id"])
    op.create_index("ix_imaging_group_id", "imaging", ["group_id"])

    op.create_table(
        "departments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(50), nullable=False, unique=True),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("is_open", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("color", sa.String(10), nullable=False, server_default="#6366f1"),
        sa.Column("icon", sa.String(50), nullable=False, server_default="Building2"),
    )
    op.create_index("ix_departments_name", "departments", ["name"])

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(100), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("role", sa.Enum("doctor", "admin", name="userrole"), nullable=False),
        sa.Column("department", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_users_username", "users", ["username"])

    op.create_table(
        "chat_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "session_id",
            sa.Integer(),
            sa.ForeignKey("chat_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("tool_calls", sa.Text(), nullable=True),
        sa.Column("reasoning", sa.Text(), nullable=True),
        sa.Column("patient_references", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="completed"),
        sa.Column("task_id", sa.String(100), nullable=True),
        sa.Column("logs", sa.Text(), nullable=True),
        sa.Column("streaming_started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("token_usage", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("last_updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_chat_messages_session_id", "chat_messages", ["session_id"])

    op.create_table(
        "visits",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("visit_id", sa.String(20), nullable=False, unique=True),
        sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patients.id"), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "intake", "triaged", "auto_routed", "pending_review",
                "routed", "in_department", "completed",
                name="visitstatus",
            ),
            nullable=False,
            server_default="intake",
        ),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("routing_suggestion", sa.JSON(), nullable=True),
        sa.Column("routing_decision", sa.JSON(), nullable=True),
        sa.Column("chief_complaint", sa.String(500), nullable=True),
        sa.Column("intake_notes", sa.Text(), nullable=True),
        sa.Column("intake_session_id", sa.Integer(), sa.ForeignKey("chat_sessions.id"), nullable=True),
        sa.Column("reviewed_by", sa.String(200), nullable=True),
        sa.Column("current_department", sa.String(50), sa.ForeignKey("departments.name"), nullable=True),
        sa.Column("queue_position", sa.Integer(), nullable=True),
        sa.Column("clinical_notes", sa.Text(), nullable=True),
        sa.Column("assigned_doctor", sa.String(200), nullable=True),
        sa.Column("urgency_level", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_visits_visit_id", "visits", ["visit_id"])
    op.create_index("ix_visits_patient_id", "visits", ["patient_id"])
    op.create_index("ix_visits_status", "visits", ["status"])
    op.create_index("ix_visits_created_at", "visits", ["created_at"])

    op.create_table(
        "orders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("visit_id", sa.Integer(), sa.ForeignKey("visits.id"), nullable=False),
        sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patients.id"), nullable=False),
        sa.Column(
            "order_type",
            sa.Enum("lab", "imaging", name="ordertype"),
            nullable=False,
        ),
        sa.Column("order_name", sa.String(200), nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "in_progress", "completed", "cancelled", name="orderstatus"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("ordered_by", sa.String(200), nullable=True),
        sa.Column("result_notes", sa.Text(), nullable=True),
        sa.Column("fulfilled_by", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_orders_visit_id", "orders", ["visit_id"])
    op.create_index("ix_orders_patient_id", "orders", ["patient_id"])

    op.create_table(
        "tools",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("symbol", sa.String(100), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("tool_type", sa.String(20), nullable=False, server_default="function"),
        sa.Column("code", sa.Text(), nullable=True),
        sa.Column("api_endpoint", sa.String(500), nullable=True),
        sa.Column("api_request_payload", sa.Text(), nullable=True),
        sa.Column("api_request_example", sa.Text(), nullable=True),
        sa.Column("api_response_payload", sa.Text(), nullable=True),
        sa.Column("api_response_example", sa.Text(), nullable=True),
        sa.Column("scope", sa.String(20), nullable=False, server_default="global"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("test_passed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "case_threads",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patients.id"), nullable=False),
        sa.Column("visit_id", sa.Integer(), sa.ForeignKey("visits.id"), nullable=True),
        sa.Column("created_by", sa.String(100), nullable=False),
        sa.Column("trigger", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("max_rounds", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("current_round", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("case_summary", sa.Text(), nullable=False),
        sa.Column("synthesis", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_case_threads_patient_id", "case_threads", ["patient_id"])
    op.create_index("ix_case_threads_visit_id", "case_threads", ["visit_id"])

    op.create_table(
        "case_messages",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "thread_id",
            sa.String(36),
            sa.ForeignKey("case_threads.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("round", sa.Integer(), nullable=False),
        sa.Column("sender_type", sa.String(20), nullable=False),
        sa.Column("specialist_role", sa.String(50), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("agrees_with", sa.JSON(), nullable=True),
        sa.Column("challenges", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_case_messages_thread_id", "case_messages", ["thread_id"])

    op.create_table(
        "allergies",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patients.id"), nullable=False),
        sa.Column("allergen", sa.String(200), nullable=False),
        sa.Column("reaction", sa.String(200), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False),
        sa.Column("recorded_at", sa.Date(), nullable=False),
    )
    op.create_index("ix_allergies_patient_id", "allergies", ["patient_id"])

    op.create_table(
        "medications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patients.id"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("dosage", sa.String(100), nullable=False),
        sa.Column("frequency", sa.String(100), nullable=False),
        sa.Column("prescribed_by", sa.String(200), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
    )
    op.create_index("ix_medications_patient_id", "medications", ["patient_id"])

    op.create_table(
        "vital_signs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patients.id"), nullable=False),
        sa.Column("visit_id", sa.Integer(), sa.ForeignKey("visits.id"), nullable=True),
        sa.Column("recorded_at", sa.DateTime(), nullable=False),
        sa.Column("systolic_bp", sa.Integer(), nullable=True),
        sa.Column("diastolic_bp", sa.Integer(), nullable=True),
        sa.Column("heart_rate", sa.Integer(), nullable=True),
        sa.Column("temperature", sa.Float(), nullable=True),
        sa.Column("respiratory_rate", sa.Integer(), nullable=True),
        sa.Column("oxygen_saturation", sa.Float(), nullable=True),
        sa.Column("weight_kg", sa.Float(), nullable=True),
        sa.Column("height_cm", sa.Float(), nullable=True),
    )
    op.create_index("ix_vital_signs_patient_id", "vital_signs", ["patient_id"])
    op.create_index("ix_vital_signs_visit_id", "vital_signs", ["visit_id"])


def downgrade() -> None:
    op.drop_index("ix_vital_signs_visit_id", table_name="vital_signs")
    op.drop_index("ix_vital_signs_patient_id", table_name="vital_signs")
    op.drop_table("vital_signs")
    op.drop_index("ix_medications_patient_id", table_name="medications")
    op.drop_table("medications")
    op.drop_index("ix_allergies_patient_id", table_name="allergies")
    op.drop_table("allergies")
    op.drop_table("case_messages")
    op.drop_table("case_threads")
    op.drop_table("tools")
    op.drop_table("orders")
    op.drop_table("visits")
    op.drop_table("chat_messages")
    op.drop_table("chat_sessions")
    op.drop_table("users")
    op.drop_index("ix_departments_name", table_name="departments")
    op.drop_table("departments")
    op.drop_table("imaging")
    op.drop_table("image_groups")
    op.drop_table("medical_records")
    op.drop_table("intake_submissions")
    op.drop_table("patients")
    op.execute("DROP TYPE IF EXISTS userrole")
    op.execute("DROP TYPE IF EXISTS visitstatus")
    op.execute("DROP TYPE IF EXISTS ordertype")
    op.execute("DROP TYPE IF EXISTS orderstatus")
    op.execute("DROP EXTENSION IF EXISTS vector")
