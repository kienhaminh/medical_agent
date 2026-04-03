"""merge_visit_steps_and_rooms

Revision ID: 79635e5d05b8
Revises: 004_add_visit_steps, 005_room_visit_unique
Create Date: 2026-04-03 16:22:04.132758

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '79635e5d05b8'
down_revision: Union[str, Sequence[str], None] = ('004_add_visit_steps', '005_room_visit_unique')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
