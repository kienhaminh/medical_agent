"""fix users table schema: rename hashed_password, add name and department

Revision ID: 260327_fix_users_schema
Revises: 23cb51726151
Create Date: 2026-03-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '260327_fix_users_schema'
down_revision: Union[str, Sequence[str], None] = '23cb51726151'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Rename hashed_password → password_hash
    op.alter_column('users', 'hashed_password', new_column_name='password_hash')

    # Add missing name column (default to username so existing rows are valid)
    op.add_column('users', sa.Column('name', sa.String(200), nullable=True))
    op.execute("UPDATE users SET name = username WHERE name IS NULL")
    op.alter_column('users', 'name', nullable=False)

    # Add missing department column
    op.add_column('users', sa.Column('department', sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'department')
    op.drop_column('users', 'name')
    op.alter_column('users', 'password_hash', new_column_name='hashed_password')
