from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import (
    String,
    Text,
    Integer,
    Boolean,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    CheckConstraint,
    UniqueConstraint,
    Index,
    Computed,
    text,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column
from .db import Base


def uid():
    return str(uuid4())


def now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uid)
    auth_issuer: Mapped[str | None] = mapped_column(String(512))
    auth_subject: Mapped[str | None] = mapped_column(String(255))
    username: Mapped[str] = mapped_column(String(24), unique=True)
    bio: Mapped[str] = mapped_column(Text, default="")
    avatar_key: Mapped[str] = mapped_column(String(20), default="initials")
    profile_revision: Mapped[int] = mapped_column(Integer, default=1)
    role: Mapped[str] = mapped_column(String(12), default="member")
    status: Mapped[str] = mapped_column(String(16), default="active")
    kind: Mapped[str] = mapped_column(String(8), default="human")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        UniqueConstraint("auth_issuer", "auth_subject"),
        CheckConstraint("username ~ '^[a-z0-9_]{3,24}$'"),
        CheckConstraint("char_length(bio) <= 300"),
        CheckConstraint("avatar_key IN ('initials','blue','sage','rose','warm')"),
        CheckConstraint("role IN ('member','admin')"),
        CheckConstraint("status IN ('active','suspended','deactivated')"),
        CheckConstraint("kind IN ('human','bot')"),
        CheckConstraint("kind = 'bot' OR (auth_issuer IS NOT NULL AND auth_subject IS NOT NULL)"),
    )


class Topic(Base):
    __tablename__ = "topics"
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uid)
    slug: Mapped[str] = mapped_column(String(60), unique=True)
    name: Mapped[str] = mapped_column(String(80))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Thread(Base):
    __tablename__ = "threads"
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uid)
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    topic_id: Mapped[str] = mapped_column(ForeignKey("topics.id"), index=True)
    type: Mapped[str] = mapped_column(String(12))
    title: Mapped[str | None] = mapped_column(Text)
    body_markdown: Mapped[str | None] = mapped_column(Text)
    search_text: Mapped[str] = mapped_column(Text, default="")
    search_vector: Mapped[object] = mapped_column(
        TSVECTOR,
        Computed(
            "setweight(to_tsvector('english'::regconfig, coalesce(title,'')), 'A') || "
            "setweight(to_tsvector('english'::regconfig, coalesce(search_text,'')), 'B')",
            persisted=True,
        ),
    )
    state: Mapped[str] = mapped_column(String(12), default="published")
    accepted_reply_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False))
    revision: Mapped[int] = mapped_column(Integer, default=1)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        CheckConstraint("type IN ('question','discussion')"),
        CheckConstraint("state IN ('published','deleted','removed')"),
        CheckConstraint(
            "state <> 'published' OR (title IS NOT NULL AND body_markdown IS NOT NULL AND char_length(trim(title)) BETWEEN 1 AND 200 AND char_length(trim(body_markdown)) BETWEEN 1 AND 10000)"
        ),
        CheckConstraint("type = 'question' OR accepted_reply_id IS NULL"),
        ForeignKeyConstraint(
            ["accepted_reply_id", "id"],
            ["replies.id", "replies.thread_id"],
            name="fk_accepted_same_thread",
            use_alter=True,
        ),
        Index("ix_threads_search", "search_vector", postgresql_using="gin"),
    )


class Reply(Base):
    __tablename__ = "replies"
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uid)
    thread_id: Mapped[str] = mapped_column(ForeignKey("threads.id"), index=True)
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    parent_reply_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False))
    response_to_reply_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False))
    depth: Mapped[int] = mapped_column(Integer, default=1)
    body_markdown: Mapped[str | None] = mapped_column(Text)
    state: Mapped[str] = mapped_column(String(12), default="published")
    revision: Mapped[int] = mapped_column(Integer, default=1)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        UniqueConstraint("id", "thread_id"),
        ForeignKeyConstraint(["parent_reply_id", "thread_id"], ["replies.id", "replies.thread_id"]),
        ForeignKeyConstraint(["response_to_reply_id", "thread_id"], ["replies.id", "replies.thread_id"]),
        CheckConstraint("depth BETWEEN 1 AND 5"),
        CheckConstraint("(parent_reply_id IS NULL) = (depth = 1)"),
        CheckConstraint("(response_to_reply_id IS NULL) = (depth = 1)"),
        CheckConstraint("parent_reply_id <> id AND response_to_reply_id <> id"),
        CheckConstraint("depth NOT BETWEEN 2 AND 4 OR parent_reply_id = response_to_reply_id"),
        CheckConstraint("state IN ('published','deleted','removed')"),
        CheckConstraint(
            "state <> 'published' OR (body_markdown IS NOT NULL AND char_length(trim(body_markdown)) BETWEEN 1 AND 5000)"
        ),
        Index("ix_reply_branch", "thread_id", "parent_reply_id", "published_at", "id"),
    )


class ThreadVote(Base):
    __tablename__ = "thread_votes"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    thread_id: Mapped[str] = mapped_column(ForeignKey("threads.id"), primary_key=True, index=True)
    value: Mapped[int] = mapped_column(Integer)
    __table_args__ = (CheckConstraint("value IN (-1,1)"),)


class ReplyVote(Base):
    __tablename__ = "reply_votes"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    reply_id: Mapped[str] = mapped_column(ForeignKey("replies.id"), primary_key=True, index=True)
    value: Mapped[int] = mapped_column(Integer)
    __table_args__ = (CheckConstraint("value IN (-1,1)"),)


class Save(Base):
    __tablename__ = "saves"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    thread_id: Mapped[str] = mapped_column(ForeignKey("threads.id"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Block(Base):
    __tablename__ = "blocks"
    blocker_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    blocked_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (CheckConstraint("blocker_id <> blocked_id"),)


class Submission(Base):
    __tablename__ = "moderation_submissions"
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(24))
    thread_id: Mapped[str | None] = mapped_column(ForeignKey("threads.id"))
    reply_id: Mapped[str | None] = mapped_column(ForeignKey("replies.id"))
    snapshot: Mapped[dict | None] = mapped_column(JSONB)
    base_revision: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(16), default="pending")
    idempotency_key: Mapped[str] = mapped_column(String(100))
    request_hash: Mapped[str] = mapped_column(String(64), index=True)
    ai_attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    next_attempt_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    lease_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    lease_token: Mapped[str | None] = mapped_column(String(36))
    reason_code: Mapped[str | None] = mapped_column(String(100))
    error_category: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        UniqueConstraint("user_id", "idempotency_key"),
        CheckConstraint(
            "action IN ('create_thread','edit_thread','create_reply','edit_reply','edit_profile')"
        ),
        CheckConstraint(
            "status IN ('pending','processing','published','rejected','cancelled','needs_review')"
        ),
        Index("ix_submission_due", "status", "next_attempt_at"),
        Index(
            "uq_open_thread_edit",
            "thread_id",
            unique=True,
            postgresql_where=text(
                "action = 'edit_thread' AND status IN ('pending','processing','needs_review')"
            ),
        ),
        Index(
            "uq_open_reply_edit",
            "reply_id",
            unique=True,
            postgresql_where=text(
                "action = 'edit_reply' AND status IN ('pending','processing','needs_review')"
            ),
        ),
        Index(
            "uq_open_profile_edit",
            "user_id",
            unique=True,
            postgresql_where=text(
                "action = 'edit_profile' AND status IN ('pending','processing','needs_review')"
            ),
        ),
    )


class Attempt(Base):
    __tablename__ = "moderation_attempts"
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uid)
    submission_id: Mapped[str] = mapped_column(ForeignKey("moderation_submissions.id"), index=True)
    source: Mapped[str] = mapped_column(String(12))
    decision: Mapped[str | None] = mapped_column(String(16))
    reason_code: Mapped[str | None] = mapped_column(String(100))
    model: Mapped[str | None] = mapped_column(String(100))
    reserved_cost_microusd: Mapped[int] = mapped_column(Integer, default=0)
    actual_cost_microusd: Mapped[int | None] = mapped_column(Integer)
    input_tokens: Mapped[int | None] = mapped_column(Integer)
    output_tokens: Mapped[int | None] = mapped_column(Integer)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uid)
    recipient_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    kind: Mapped[str] = mapped_column(String(24))
    thread_id: Mapped[str] = mapped_column(ForeignKey("threads.id"))
    reply_id: Mapped[str] = mapped_column(ForeignKey("replies.id"))
    event_id: Mapped[str] = mapped_column(UUID(as_uuid=False), default=uid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (UniqueConstraint("recipient_id", "event_id"),)


class Report(Base):
    __tablename__ = "reports"
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uid)
    reporter_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    thread_id: Mapped[str | None] = mapped_column(ForeignKey("threads.id"))
    reply_id: Mapped[str | None] = mapped_column(ForeignKey("replies.id"))
    subject_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    reason: Mapped[str] = mapped_column(String(30))
    detail: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(12), default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (
        CheckConstraint("num_nonnulls(thread_id, reply_id, subject_user_id) = 1"),
        UniqueConstraint("reporter_id", "thread_id"),
        UniqueConstraint("reporter_id", "reply_id"),
        UniqueConstraint("reporter_id", "subject_user_id"),
    )


class AdminAction(Base):
    __tablename__ = "admin_actions"
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uid)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(50))
    target_id: Mapped[str] = mapped_column(String(100))
    reason: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class RateBucket(Base):
    __tablename__ = "rate_buckets"
    subject_key: Mapped[str] = mapped_column(String(100), primary_key=True)
    action: Mapped[str] = mapped_column(String(50), primary_key=True)
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    count: Mapped[int] = mapped_column(Integer, default=1)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Erasure(Base):
    __tablename__ = "erasure_events"
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uid)
    target_type: Mapped[str] = mapped_column(String(30))
    target_id: Mapped[str] = mapped_column(String(100))
    action: Mapped[str] = mapped_column(String(30))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class IdempotentAction(Base):
    __tablename__ = "idempotent_actions"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    key: Mapped[str] = mapped_column(String(36), primary_key=True)
    request_hash: Mapped[str] = mapped_column(String(64))
    result: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class RuntimeControl(Base):
    __tablename__ = "runtime_controls"
    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    value: Mapped[bool] = mapped_column(Boolean, default=False)


Index("ix_thread_feed", Thread.state, Thread.published_at.desc(), Thread.id.desc())
Index("ix_topic_feed", Thread.topic_id, Thread.state, Thread.published_at.desc(), Thread.id.desc())
Index("ix_save_owner_date", Save.user_id, Save.created_at.desc())
Index("ix_block_reverse", Block.blocked_id, Block.blocker_id)
Index("ix_notification_owner_date", Notification.recipient_id, Notification.created_at.desc())
Index("ix_notification_unread", Notification.recipient_id, postgresql_where=text("read_at IS NULL"))
Index("ix_report_queue", Report.status, Report.created_at)
Index("ix_submission_owner_date", Submission.user_id, Submission.created_at.desc())
Index("ix_attempt_time", Attempt.started_at)
Index("ix_rate_expiry", RateBucket.expires_at)
