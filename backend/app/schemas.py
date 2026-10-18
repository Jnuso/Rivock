from datetime import datetime
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, StrictBool, field_validator


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Onboard(Input):
    username: str = Field(min_length=3, max_length=24, pattern=r"^[a-zA-Z0-9_]+$")

    @field_validator("username")
    @classmethod
    def normalize(cls, value):
        return value.lower()


class ThreadCreate(Input):
    type: Literal["question", "discussion"]
    topic_id: UUID
    title: str = Field(min_length=1, max_length=200)
    body_markdown: str = Field(min_length=1, max_length=10000)


class ThreadEdit(Input):
    base_revision: int = Field(ge=1)
    topic_id: UUID
    title: str = Field(min_length=1, max_length=200)
    body_markdown: str = Field(min_length=1, max_length=10000)


class ReplyCreate(Input):
    body_markdown: str = Field(min_length=1, max_length=5000)
    response_to_reply_id: UUID | None = None


class ReplyEdit(Input):
    base_revision: int = Field(ge=1)
    body_markdown: str = Field(min_length=1, max_length=5000)


class ProfileEdit(Input):
    base_revision: int = Field(ge=1)
    bio: str = Field(max_length=300)
    avatar_key: Literal["initials", "blue", "sage", "rose", "warm"]


class VoteIn(Input):
    value: Literal[-1, 1]


class AcceptIn(Input):
    reply_id: UUID


class Reason(Input):
    reason: str = Field(min_length=1, max_length=1000)


class Decision(Reason):
    decision: Literal["approve", "reject"]


class PauseIn(Reason):
    paused: bool


class AdminContentOut(BaseModel):
    id: str
    state: str
    title: str | None
    body_markdown: str | None
    author_id: str
    revision: int
    restore_until: datetime | None


class ReportIn(Input):
    thread_id: UUID | None = None
    reply_id: UUID | None = None
    user_id: UUID | None = None
    reason: Literal["spam/scam", "harassment", "hate/threat", "personal information", "other"]
    detail: str = Field(default="", max_length=1000)


class ReportResolve(Reason):
    status: Literal["resolved", "dismissed"]


class TopicCreate(Input):
    slug: str = Field(min_length=1, max_length=60, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    name: str = Field(min_length=1, max_length=80)
    sort_order: int = 0


class TopicEdit(Input):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    sort_order: int | None = None
    is_active: bool | None = None


class PublicUser(BaseModel):
    id: str
    username: str
    bio: str = ""
    avatar_key: str = "initials"
    is_bot: bool = False
    created_at: datetime | None = None


class PrivateUser(PublicUser):
    profile_revision: int
    role: Literal["member", "admin"]
    status: Literal["active", "suspended", "deactivated"]
    kind: str


class MeOut(BaseModel):
    onboarding_required: bool
    user: PrivateUser | None


class TopicOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    slug: str
    name: str
    sort_order: int
    is_active: bool


class ThreadOut(BaseModel):
    id: str
    type: Literal["question", "discussion"]
    topic: TopicOut
    title: str
    body_markdown: str | None = None
    excerpt: str
    author: PublicUser | None
    published_at: datetime
    edited_at: datetime | None
    revision: int
    state: str
    score: int | None
    reply_count: int
    accepted_reply_id: str | None
    has_accepted_answer: bool
    my_vote: Literal[-1, 1] | None
    is_saved: bool


class ResponseTarget(BaseModel):
    reply_id: str
    username: str


class ReplyOut(BaseModel):
    id: str
    thread_id: str
    parent_reply_id: str | None
    response_to_reply_id: str | None
    response_to: ResponseTarget | None
    depth: int
    body_markdown: str | None
    author: PublicUser | None
    state: str
    revision: int
    published_at: datetime
    edited_at: datetime | None
    score: int | None
    my_vote: Literal[-1, 1] | None
    is_accepted: bool
    child_count: int


class ReplyContextOut(BaseModel):
    thread_id: str
    replies: list[ReplyOut]


class ThreadList(BaseModel):
    items: list[ThreadOut]
    next_offset: int | None


class ReplyList(BaseModel):
    items: list[ReplyOut]
    next_offset: int | None


class ReviewOut(BaseModel):
    source: Literal["ai", "rules", "fixture", "admin"]
    decision: Literal["allow", "reject", "uncertain"]
    model: str | None
    completed_at: datetime


class SubmissionOut(BaseModel):
    id: str
    status: str
    action: str
    content_id: str | None
    thread_id: str | None
    reason_code: str | None
    error_category: str | None
    next_attempt_at: datetime | None
    created_at: datetime
    snapshot_available: bool
    snapshot: dict | None = None
    review: ReviewOut | None = None


class MutationOut(BaseModel):
    submission: SubmissionOut
    content: ThreadOut | ReplyOut | PrivateUser | None


class SubmissionList(BaseModel):
    items: list[SubmissionOut]
    next_offset: int | None


class VoteOut(BaseModel):
    score: int
    my_vote: Literal[-1, 1] | None


class AcceptedOut(BaseModel):
    accepted_reply_id: str | None


class CountOut(BaseModel):
    count: int


class Deactivate(Input):
    confirm_username: str


class ReadIn(Input):
    read: StrictBool


class ReadAll(Input):
    through: datetime


class NotificationOut(BaseModel):
    id: str
    kind: str
    read: bool
    created_at: datetime
    actor: PublicUser | None
    target_type: str | None
    target_id: str | None
    reply_id: str | None
    summary: str
    available: bool


class NotificationList(BaseModel):
    items: list[NotificationOut]
    next_offset: int | None
    as_of: datetime


class BlockOut(BaseModel):
    user_id: str
    username: str
    created_at: datetime


class ReportOut(BaseModel):
    id: str
    status: str
    reason: str
    detail: str
    created_at: datetime
    thread_id: str | None
    reply_id: str | None
    user_id: str | None


class ReportList(BaseModel):
    items: list[ReportOut]
    next_offset: int | None


class ActionOut(BaseModel):
    id: str
    action: str
    target_id: str
    reason: str
    created_at: datetime
    actor_username: str


class ActionList(BaseModel):
    items: list[ActionOut]
    next_offset: int | None


class ContributionList(BaseModel):
    items: list[ThreadOut | ReplyOut]
    next_offset: int | None


class ErrorDetail(BaseModel):
    code: str
    message: str
    request_id: str
    submission_id: str | None = None
    fields: dict[str, str] | None = None


class InfoOut(BaseModel):
    local_fixture_moderation: bool


class AdminStatusOut(BaseModel):
    moderation_mode: str
    ai_paused: bool
    monthly_budget_usd: float
    reserved_or_used_usd: float
    queue_count: int


class PauseOut(BaseModel):
    paused: bool


class ErrorOut(BaseModel):
    error: ErrorDetail
