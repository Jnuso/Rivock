import hashlib
import json
from typing import Annotated
from datetime import timedelta
from uuid import UUID
from fastapi import APIRouter, Depends
from fastapi.encoders import jsonable_encoder
from sqlalchemy import select, func
from . import models as m, schemas as v, services as s, moderation as mod, auth
from .config import settings
from .routes import DB, Limit, Offset, Key, read_budget, report_out, ERROR_RESPONSES

Admin = Annotated[object, Depends(auth.admin)]
router = APIRouter(prefix="/api/v1/admin", dependencies=[Depends(read_budget)], responses=ERROR_RESPONSES)


def action(db, user, key, operation, target, payload, perform):
    try:
        key = str(UUID(key))
    except (TypeError, ValueError):
        s.fail(422, "idempotency_required", "Send an Idempotency-Key UUID header.")
    digest = hashlib.sha256(
        json.dumps([operation, str(target), payload], sort_keys=True).encode()
    ).hexdigest()
    old = db.get(m.IdempotentAction, (user.id, key))
    if old:
        if old.request_hash != digest:
            s.fail(409, "idempotency_conflict", "Use a fresh key for a different action.")
        return old.result
    result = jsonable_encoder(perform())
    db.add(m.IdempotentAction(user_id=user.id, key=key, request_hash=digest, result=result))
    return result


@router.get("/reports", response_model=v.ReportList)
def reports(db: DB, user: Admin, status: str = "open", limit: Limit = 20, offset: Offset = 0):
    rows = list(
        db.scalars(
            select(m.Report)
            .where(m.Report.status == status)
            .order_by(m.Report.created_at, m.Report.id)
            .offset(offset)
            .limit(limit + 1)
        )
    )
    return s.page(rows, offset, limit, report_out)


@router.patch("/reports/{id}", response_model=v.ReportOut)
def resolve(id: UUID, body: v.ReportResolve, db: DB, user: Admin):
    row = s.require_row(db, m.Report, id, True)
    s.audit(db, user, "resolve_report", id, body.reason)
    row.status, row.resolved_at = body.status, m.now()
    return report_out(row)


@router.get("/submissions", response_model=v.SubmissionList)
def submissions(db: DB, user: Admin, status: str | None = None, limit: Limit = 20, offset: Offset = 0):
    stmt = (
        select(m.Submission).where(m.Submission.status == status)
        if status
        else select(m.Submission).where(m.Submission.status.in_(s.OPEN))
    )
    rows = list(
        db.scalars(stmt.order_by(m.Submission.created_at, m.Submission.id).offset(offset).limit(limit + 1))
    )
    return s.submission_page(db, rows, offset, limit, snapshot=True)


@router.get("/submissions/{id}", response_model=v.SubmissionOut)
def submission(id: UUID, db: DB, user: Admin):
    row = s.require_row(db, m.Submission, id)
    return s.submission_out(row, True, review=s.submission_reviews(db, [row.id]).get(row.id))


@router.post("/submissions/{id}/decision", response_model=v.SubmissionOut)
def decide(id: UUID, body: v.Decision, db: DB, user: Admin, idempotency_key: Key = None):
    def perform():
        row = s.require_row(db, m.Submission, id, True)
        if row.status not in s.OPEN:
            s.fail(409, "terminal_submission", "This submission is already complete.")
        s.audit(db, user, "submission_" + body.decision, id, body.reason)
        row.lease_token, row.lease_until = None, None
        mod.apply(db, row, "allow" if body.decision == "approve" else "reject", "admin_decision")
        db.add(
            m.Attempt(
                submission_id=row.id,
                source="admin",
                decision=body.decision,
                reason_code="admin_decision",
                finished_at=m.now(),
            )
        )
        return s.submission_out(row, review=s.submission_reviews(db, [row.id]).get(row.id))

    return action(db, user, idempotency_key, "decision", id, body.model_dump(), perform)


@router.post("/submissions/{id}/retry", response_model=v.SubmissionOut)
def retry(id: UUID, db: DB, user: Admin, idempotency_key: Key = None):
    def perform():
        row = s.require_row(db, m.Submission, id, True)
        if row.status not in s.OPEN:
            s.fail(409, "terminal_submission", "This submission is already complete.")
        if row.status == "processing" and row.lease_until and row.lease_until > m.now():
            s.fail(409, "attempt_in_progress", "An attempt is already running.")
        if row.ai_attempt_count >= 4 or row.created_at < m.now() - timedelta(hours=24):
            s.fail(409, "retry_limit", "Review this submission manually.")
        row.status, row.next_attempt_at, row.lease_token, row.lease_until = "pending", m.now(), None, None
        s.audit(db, user, "retry_submission", id, "Operator scheduled a bounded retry")
        return s.submission_out(row, review=s.submission_reviews(db, [row.id]).get(row.id))

    return action(db, user, idempotency_key, "retry", id, {}, perform)


def content_action(db, user, key, cls, id, operation, body):
    def perform():
        row = s.require_row(db, cls, id, True)
        s.audit(db, user, operation + "_" + cls.__tablename__, id, body.reason)
        if operation == "remove":
            if row.state == "deleted":
                s.fail(409, "deleted", "Deleted content cannot be restored or removed again.")
            if row.state != "removed":
                s.erase_content(db, row, "removed")
        else:
            if (
                row.state != "removed"
                or not row.body_markdown
                or row.updated_at < m.now() - timedelta(days=7)
            ):
                s.fail(409, "not_restorable", "This contribution is outside its restore window.")
            row.state, row.revision, row.updated_at = "published", row.revision + 1, m.now()
            if cls == m.Thread:
                row.search_text = s.plain(row.body_markdown)
        return None

    return action(db, user, key, cls.__tablename__ + "_" + operation, id, body.model_dump(), perform)


def inspect(db, cls, id):
    row = s.require_row(db, cls, id)
    until = row.updated_at + timedelta(days=7) if row.state == "removed" and row.body_markdown else None
    retained = row.state != "deleted" and (row.state != "removed" or (until and until > m.now()))
    return {
        "id": row.id,
        "state": row.state,
        "title": getattr(row, "title", None) if retained else None,
        "body_markdown": row.body_markdown if retained else None,
        "author_id": row.author_id,
        "revision": row.revision,
        "restore_until": until,
    }


@router.get("/threads/{id}", response_model=v.AdminContentOut)
def inspect_thread(id: UUID, db: DB, user: Admin):
    return inspect(db, m.Thread, id)


@router.get("/replies/{id}", response_model=v.AdminContentOut)
def inspect_reply(id: UUID, db: DB, user: Admin):
    return inspect(db, m.Reply, id)


@router.post("/threads/{id}/remove", status_code=204)
def remove_thread(id: UUID, body: v.Reason, db: DB, user: Admin, idempotency_key: Key = None):
    content_action(db, user, idempotency_key, m.Thread, id, "remove", body)


@router.post("/threads/{id}/restore", status_code=204)
def restore_thread(id: UUID, body: v.Reason, db: DB, user: Admin, idempotency_key: Key = None):
    content_action(db, user, idempotency_key, m.Thread, id, "restore", body)


@router.post("/replies/{id}/remove", status_code=204)
def remove_reply(id: UUID, body: v.Reason, db: DB, user: Admin, idempotency_key: Key = None):
    content_action(db, user, idempotency_key, m.Reply, id, "remove", body)


@router.post("/replies/{id}/restore", status_code=204)
def restore_reply(id: UUID, body: v.Reason, db: DB, user: Admin, idempotency_key: Key = None):
    content_action(db, user, idempotency_key, m.Reply, id, "restore", body)


def user_action(db, user, key, id, operation, body):
    def perform():
        row = s.require_row(db, m.User, id, True)
        if row.status == "deactivated":
            s.fail(409, "deactivated", "This account has been deactivated.")
        s.audit(db, user, operation + "_user", id, body.reason)
        if operation == "clear-bio":
            row.bio, row.profile_revision = "", row.profile_revision + 1
            s.cancel_edits(db, "edit_profile", row.id, "bio_cleared")
            for sub in db.scalars(
                select(m.Submission).where(
                    m.Submission.user_id == row.id, m.Submission.action == "edit_profile"
                )
            ):
                sub.snapshot = None
            db.add(m.Erasure(target_type="user", target_id=row.id, action="clear_bio"))
        elif operation == "suspend":
            if (
                row.role == "admin"
                and row.status == "active"
                and db.scalar(
                    select(func.count())
                    .select_from(m.User)
                    .where(m.User.role == "admin", m.User.status == "active")
                )
                <= 1
            ):
                s.fail(409, "last_admin", "The last active admin cannot be suspended.")
            row.status = "suspended"
            for sub in db.scalars(
                select(m.Submission).where(m.Submission.user_id == row.id, m.Submission.status.in_(s.OPEN))
            ):
                sub.status, sub.reason_code, sub.lease_token, sub.lease_until = (
                    "cancelled",
                    "account_inactive",
                    None,
                    None,
                )
        else:
            row.status = "active"
        row.updated_at = m.now()
        return None

    return action(db, user, key, operation + "_user", id, body.model_dump(), perform)


@router.post("/users/{id}/suspend", status_code=204)
def suspend(id: UUID, body: v.Reason, db: DB, user: Admin, idempotency_key: Key = None):
    user_action(db, user, idempotency_key, id, "suspend", body)


@router.post("/users/{id}/restore", status_code=204)
def restore_user(id: UUID, body: v.Reason, db: DB, user: Admin, idempotency_key: Key = None):
    user_action(db, user, idempotency_key, id, "restore", body)


@router.post("/users/{id}/clear-bio", status_code=204)
def clear_bio(id: UUID, body: v.Reason, db: DB, user: Admin, idempotency_key: Key = None):
    user_action(db, user, idempotency_key, id, "clear-bio", body)


@router.get("/actions", response_model=v.ActionList)
def actions(db: DB, user: Admin, limit: Limit = 20, offset: Offset = 0):
    rows = list(
        db.scalars(
            select(m.AdminAction)
            .order_by(m.AdminAction.created_at.desc(), m.AdminAction.id)
            .offset(offset)
            .limit(limit + 1)
        )
    )
    return s.page(
        rows,
        offset,
        limit,
        lambda r: (
            {k: getattr(r, k) for k in ["id", "action", "target_id", "reason", "created_at"]}
            | {"actor_username": s.public_user(db.get(m.User, r.actor_id))["username"]}
        ),
    )


@router.post("/topics", response_model=v.TopicOut, status_code=201)
def create_topic(body: v.TopicCreate, db: DB, user: Admin):
    if db.scalar(select(m.Topic.id).where(m.Topic.slug == body.slug)):
        s.fail(409, "slug_taken", "This topic slug already exists.")
    row = m.Topic(**body.model_dump())
    db.add(row)
    db.flush()
    s.audit(db, user, "create_topic", row.id, "Created topic: " + body.name)
    return row


@router.patch("/topics/{id}", response_model=v.TopicOut)
def edit_topic(id: UUID, body: v.TopicEdit, db: DB, user: Admin):
    row = s.require_row(db, m.Topic, id, True)
    changes = body.model_dump(exclude_unset=True)
    if not changes or any(value is None for value in changes.values()):
        s.fail(422, "invalid_changes", "Supply at least one non-null topic setting.")
    for key, value in changes.items():
        setattr(row, key, value)
    s.audit(db, user, "edit_topic", id, "Changed topic settings: " + json.dumps(changes, sort_keys=True))
    return row


@router.get("/status", response_model=v.AdminStatusOut)
def status(db: DB, user: Admin):
    cfg = settings()
    month = m.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    usage = db.scalar(
        select(
            func.coalesce(
                func.sum(func.coalesce(m.Attempt.actual_cost_microusd, m.Attempt.reserved_cost_microusd)), 0
            )
        ).where(m.Attempt.started_at >= month)
    )
    control = db.get(m.RuntimeControl, "ai_paused")
    return {
        "moderation_mode": cfg.moderation_mode,
        "ai_paused": cfg.ai_paused or bool(control and control.value),
        "monthly_budget_usd": cfg.ai_monthly_budget_usd,
        "reserved_or_used_usd": usage / 1_000_000,
        "queue_count": db.scalar(
            select(func.count()).select_from(m.Submission).where(m.Submission.status.in_(s.OPEN))
        ),
    }


@router.put("/pause", response_model=v.PauseOut)
def pause(body: v.PauseIn, db: DB, user: Admin):
    row = db.get(m.RuntimeControl, "ai_paused")
    if row:
        row.value = body.paused
    else:
        db.add(m.RuntimeControl(key="ai_paused", value=body.paused))
    s.audit(db, user, "ai_pause" if body.paused else "ai_resume", "moderation", body.reason)
    return {"paused": body.paused or settings().ai_paused}
