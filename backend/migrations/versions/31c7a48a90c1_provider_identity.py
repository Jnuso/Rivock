"""Use issuer/subject identities; preserve old Entra linkage under an inert namespace."""

from alembic import op
import sqlalchemy as sa

revision = "31c7a48a90c1"
down_revision = "20045d5058e4"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        "users",
        "entra_tenant_id",
        new_column_name="auth_issuer",
        existing_type=sa.String(100),
        type_=sa.String(512),
    )
    op.alter_column(
        "users",
        "entra_object_id",
        new_column_name="auth_subject",
        existing_type=sa.String(100),
        type_=sa.String(255),
    )
    # No email matching or silent account takeover when the identity provider changes.
    op.execute("UPDATE users SET auth_issuer = 'legacy-entra:' || auth_issuer WHERE auth_issuer IS NOT NULL")


def downgrade():
    if op.get_bind().scalar(
        sa.text(
            "SELECT count(*) FROM users WHERE auth_issuer IS NOT NULL AND auth_issuer NOT LIKE 'legacy-entra:%'"
        )
    ):
        raise RuntimeError(
            "Cannot downgrade provider identities containing new accounts; keep schema and roll forward"
        )
    op.execute("UPDATE users SET auth_issuer = substring(auth_issuer from 14) WHERE auth_issuer IS NOT NULL")
    op.alter_column(
        "users",
        "auth_issuer",
        new_column_name="entra_tenant_id",
        existing_type=sa.String(512),
        type_=sa.String(100),
    )
    op.alter_column(
        "users",
        "auth_subject",
        new_column_name="entra_object_id",
        existing_type=sa.String(255),
        type_=sa.String(100),
    )
