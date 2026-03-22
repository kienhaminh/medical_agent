"""add indexes on foreign key columns

Revision ID: 260322_add_fk_indexes
Revises: 001_create_skill_tables
Create Date: 2026-03-22 00:00:00.000000

"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "260322_add_fk_indexes"
down_revision = "001_create_skill_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_imaging_patient_id", "imaging", ["patient_id"])
    op.create_index("ix_imaging_group_id", "imaging", ["group_id"])
    op.create_index("ix_image_groups_patient_id", "image_groups", ["patient_id"])
    op.create_index("ix_medical_records_patient_id", "medical_records", ["patient_id"])
    op.create_index("ix_chat_sessions_agent_id", "chat_sessions", ["agent_id"])
    op.create_index("ix_chat_messages_session_id", "chat_messages", ["session_id"])
    op.create_index("ix_tools_assigned_agent_id", "tools", ["assigned_agent_id"])
    op.create_index("ix_sub_agents_parent_template_id", "sub_agents", ["parent_template_id"])


def downgrade() -> None:
    op.drop_index("ix_imaging_patient_id", table_name="imaging")
    op.drop_index("ix_imaging_group_id", table_name="imaging")
    op.drop_index("ix_image_groups_patient_id", table_name="image_groups")
    op.drop_index("ix_medical_records_patient_id", table_name="medical_records")
    op.drop_index("ix_chat_sessions_agent_id", table_name="chat_sessions")
    op.drop_index("ix_chat_messages_session_id", table_name="chat_messages")
    op.drop_index("ix_tools_assigned_agent_id", table_name="tools")
    op.drop_index("ix_sub_agents_parent_template_id", table_name="sub_agents")
