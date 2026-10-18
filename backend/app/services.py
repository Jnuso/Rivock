import hashlib
import hmac
from datetime import timedelta
from dataclasses import dataclass
from markdown_it import MarkdownIt
from sqlalchemy import select, func, or_
from sqlalchemy.dialects.postgresql import insert
from . import models as m
from .errors import fail
from .config import settings

OPEN = {"pending", "processing", "needs_review"}
markdown = MarkdownIt("commonmark", {"html": False})


def plain(value):
    result = []
    for token in markdown.parse(value or ""):
        if token.type == "inline":
            result.extend(t.content for t in (token.children or []) if t.type in {"text", "code_inline"})
    return " ".join(result)


def content_text(value, limit, allow_empty=False):
    if len(value) > limit or (not allow_empty and not plain(value).strip()):
        fail(422, "invalid_text", "Enter meaningful text within the character limit.")


def lock_users(db, *ids):
    return list(
        db.scalars(
            select(m.User)
            .where(m.User.id.in_(sorted(set(ids))))
            .order_by(m.User.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    )


def active(user):
    if user.status != "active":
        fail(403, "account_inactive", "This account cannot participate.")


def blocked(db, a, b):
    if not a or not b:
        return False
    return (
        db.scalar(
            select(m.Block.blocker_id)
            .where(
                or_(
                    (m.Block.blocker_id == a) & (m.Block.blocked_id == b),
                    (m.Block.blocker_id == b) & (m.Block.blocked_id == a),
                )
            )
            .limit(1)
        )
        is not None
    )


def hidden_ids(db, user):
    return set(db.scalars(select(m.Block.blocked_id).where(m.Block.blocker_id == user.id))) if user else set()


def interact(db, actor, *authors):
    lock_users(db, actor.id, *authors)
    active(actor)
    if any(blocked(db, actor.id, author) for author in authors):
        fail(403, "blocked_interaction", "This interaction is unavailable.")


def require_row(db, cls, key, lock=False):
    stmt = select(cls).where(cls.id == str(key))
    if lock:
        stmt = stmt.with_for_update().execution_options(populate_existing=True)
    row = db.scalar(stmt)
    if row is None:
        fail(404, "not_found", "This item is unavailable.")
    return row


def owned(row, user):
    if row.author_id != user.id:
        fail(403, "not_owner", "Only the author can do that.")


def rate(db, subject, action, limit, seconds):
    stamp = m.now()
    start = stamp.replace(microsecond=0) - timedelta(seconds=int(stamp.timestamp()) % seconds)
    stmt = insert(m.RateBucket).values(
        subject_key=subject,
        action=action,
        window_start=start,
        count=1,
        expires_at=start + timedelta(seconds=max(seconds, 172800)),
    )
    count = db.scalar(
        stmt.on_conflict_do_update(
            index_elements=[m.RateBucket.subject_key, m.RateBucket.action, m.RateBucket.window_start],
            set_={"count": m.RateBucket.count + 1},
        ).returning(m.RateBucket.count)
    )
    if count > limit:
        from fastapi import HTTPException

        retry = max(1, int((start + timedelta(seconds=seconds) - stamp).total_seconds()))
        raise HTTPException(
            429,
            {"code": "rate_limited", "message": "Please wait before trying again."},
            headers={"Retry-After": str(retry)},
        )


def read_rate(db, request, user):
    ip = request.client.host if request.client else "unknown"
    if ip in settings().trusted_proxy_ips.split(","):
        forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        if forwarded:
            ip = forwarded
    day = m.now().date().isoformat()
    digest = hmac.new(
        settings().rate_hmac_secret.encode(), f"{day}:{ip}".encode(), hashlib.sha256
    ).hexdigest()
    rate(db, digest, "read_ip", 300 if user else 120, 60)
    if user:
        rate(db, user.id, "read_account", 240, 60)


def public_user(user):
    if user.status == "deactivated":
        return {
            "id": user.id,
            "username": "[deleted]",
            "bio": "",
            "avatar_key": "initials",
            "is_bot": False,
            "created_at": None,
        }
    return {
        "id": user.id,
        "username": user.username,
        "bio": user.bio,
        "avatar_key": user.avatar_key,
        "is_bot": user.kind == "bot",
        "created_at": user.created_at,
    }


def private_user(user):
    return {
        **public_user(user),
        "profile_revision": user.profile_revision,
        "role": user.role,
        "status": user.status,
        "kind": user.kind,
    }


def topic_out(topic):
    return {key: getattr(topic, key) for key in ["id", "slug", "name", "sort_order", "is_active"]}


@dataclass(frozen=True)
class _ThreadReadBatch:
    hidden: set[str]
    topics: dict[str, m.Topic]
    authors: dict[str, m.User]
    accepted: dict[str, m.Reply]
    reply_counts: dict[str, int]
    scores: dict[str, int]
    votes: dict[str, int]
    saved: set[str]


def thread_summaries(db, rows, user=None, *, hidden=None):
    """Project one bounded page with request-local data; never cache viewer state."""
    if not rows:
        return []
    hide = hidden_ids(db, user) if hidden is None else hidden
    ids = [row.id for row in rows]
    topic_ids = {row.topic_id for row in rows}
    author_ids = {row.author_id for row in rows if row.state == "published" and row.author_id not in hide}
    accepted_ids = {row.accepted_reply_id for row in rows if row.accepted_reply_id}
    topics = {row.id: row for row in db.scalars(select(m.Topic).where(m.Topic.id.in_(topic_ids)))}
    authors = (
        {row.id: row for row in db.scalars(select(m.User).where(m.User.id.in_(author_ids)))}
        if author_ids
        else {}
    )
    accepted = (
        {row.id: row for row in db.scalars(select(m.Reply).where(m.Reply.id.in_(accepted_ids)))}
        if accepted_ids
        else {}
    )
    reply_counts = dict(
        db.execute(
            select(m.Reply.thread_id, func.count())
            .where(m.Reply.thread_id.in_(ids), m.Reply.state == "published", m.Reply.author_id.not_in(hide))
            .group_by(m.Reply.thread_id)
        ).all()
    )
    scores = dict(
        db.execute(
            select(m.ThreadVote.thread_id, func.sum(m.ThreadVote.value))
            .where(m.ThreadVote.thread_id.in_(ids))
            .group_by(m.ThreadVote.thread_id)
        ).all()
    )
    votes = (
        dict(
            db.execute(
                select(m.ThreadVote.thread_id, m.ThreadVote.value).where(
                    m.ThreadVote.thread_id.in_(ids), m.ThreadVote.user_id == user.id
                )
            ).all()
        )
        if user
        else {}
    )
    saved = (
        set(db.scalars(select(m.Save.thread_id).where(m.Save.thread_id.in_(ids), m.Save.user_id == user.id)))
        if user
        else set()
    )
    batch = _ThreadReadBatch(hide, topics, authors, accepted, reply_counts, scores, votes, saved)
    return [thread_out(db, row, user, False, _batch=batch) for row in rows]


def thread_out(db, row, user=None, detail=True, *, _batch: _ThreadReadBatch | None = None):
    hide = _batch.hidden if _batch else hidden_ids(db, user)
    visible = row.state == "published" and row.author_id not in hide
    state = row.state if row.author_id not in hide else "blocked"
    if _batch:
        topic = _batch.topics[row.topic_id]
        author = _batch.authors.get(row.author_id)
        accepted = _batch.accepted.get(row.accepted_reply_id)
        reply_count = _batch.reply_counts.get(row.id, 0)
        score = int(_batch.scores.get(row.id, 0))
        my_vote = _batch.votes.get(row.id)
        saved = row.id in _batch.saved
    else:
        topic = db.get(m.Topic, row.topic_id)
        author = db.get(m.User, row.author_id) if visible else None
        accepted = db.get(m.Reply, row.accepted_reply_id) if row.accepted_reply_id else None
        reply_count = db.scalar(
            select(func.count())
            .select_from(m.Reply)
            .where(m.Reply.thread_id == row.id, m.Reply.state == "published", m.Reply.author_id.not_in(hide))
        )
        score = (
            int(
                db.scalar(
                    select(func.coalesce(func.sum(m.ThreadVote.value), 0)).where(
                        m.ThreadVote.thread_id == row.id
                    )
                )
            )
            if visible
            else None
        )
        vote = db.get(m.ThreadVote, (user.id, row.id)) if user else None
        my_vote = vote.value if vote else None
        saved = bool(user and db.get(m.Save, (user.id, row.id)))
    accepted_id = (
        accepted.id
        if accepted and accepted.state == "published" and accepted.author_id not in hide and visible
        else None
    )
    return {
        "id": row.id,
        "type": row.type,
        "topic": topic_out(topic),
        "title": row.title if visible else f"[{state.capitalize()} thread]",
        "body_markdown": row.body_markdown if visible and detail else None,
        "excerpt": plain(row.body_markdown)[:240] if visible else "This thread is unavailable.",
        "author": public_user(author) if visible else None,
        "published_at": row.published_at,
        "edited_at": row.edited_at,
        "revision": row.revision,
        "state": state,
        "score": score if visible else None,
        "reply_count": reply_count,
        "accepted_reply_id": accepted_id,
        "has_accepted_answer": bool(accepted_id),
        "my_vote": my_vote if visible else None,
        "is_saved": saved,
    }


def reply_out(db, row, user=None):
    hide = hidden_ids(db, user)
    visible = row.state == "published" and row.author_id not in hide
    target = db.get(m.Reply, row.response_to_reply_id) if row.response_to_reply_id else None
    target_name = None
    if target:
        target_name = (
            public_user(db.get(m.User, target.author_id))["username"]
            if target.state == "published" and target.author_id not in hide
            else "[unavailable]"
        )
    vote = db.get(m.ReplyVote, (user.id, row.id)) if user else None
    thread = db.get(m.Thread, row.thread_id)
    return {
        "id": row.id,
        "thread_id": row.thread_id,
        "parent_reply_id": row.parent_reply_id,
        "response_to_reply_id": row.response_to_reply_id,
        "response_to": {"reply_id": target.id, "username": target_name} if target else None,
        "depth": row.depth,
        "body_markdown": row.body_markdown if visible else None,
        "author": public_user(db.get(m.User, row.author_id)) if visible else None,
        "state": row.state if row.author_id not in hide else "blocked",
        "revision": row.revision,
        "published_at": row.published_at,
        "edited_at": row.edited_at,
        "score": int(
            db.scalar(
                select(func.coalesce(func.sum(m.ReplyVote.value), 0)).where(m.ReplyVote.reply_id == row.id)
            )
        )
        if visible
        else None,
        "my_vote": vote.value if vote and visible else None,
        "is_accepted": bool(
            visible
            and thread.state == "published"
            and thread.author_id not in hide
            and thread.accepted_reply_id == row.id
        ),
        "child_count": db.scalar(
            select(func.count()).select_from(m.Reply).where(m.Reply.parent_reply_id == row.id)
        ),
    }


def submission_reviews(db, ids):
    """Private completed-check summaries, batched for the visible submissions page."""
    if not ids:
        return {}
    attempts = db.scalars(
        select(m.Attempt)
        .where(
            m.Attempt.submission_id.in_(ids),
            m.Attempt.source.in_(["ai", "rules", "fixture", "admin"]),
            m.Attempt.decision.in_(["allow", "approve", "reject", "uncertain"]),
            m.Attempt.finished_at.is_not(None),
        )
        .distinct(m.Attempt.submission_id)
        .order_by(m.Attempt.submission_id, m.Attempt.started_at.desc(), m.Attempt.id.desc())
    )
    return {
        attempt.submission_id: {
            "source": attempt.source,
            "decision": "allow" if attempt.decision == "approve" else attempt.decision,
            "model": attempt.model if attempt.source == "ai" else None,
            "completed_at": attempt.finished_at,
        }
        for attempt in attempts
    }


def submission_page(db, rows, offset, limit, snapshot=False):
    reviews = submission_reviews(db, [row.id for row in rows[:limit]])
    return page(
        rows, offset, limit,
        lambda row: submission_out(row, snapshot, review=reviews.get(row.id)),
    )


def submission_out(row, snapshot=False, review=None):
    content_id = row.reply_id or row.thread_id or (row.user_id if row.action == "edit_profile" else None)
    if row.action.startswith("create") and row.status != "published":
        content_id = None
    return {
        "id": row.id,
        "action": row.action,
        "status": row.status,
        "content_id": content_id,
        "thread_id": row.thread_id,
        "reason_code": row.reason_code,
        "error_category": row.error_category,
        "next_attempt_at": row.next_attempt_at if row.status == "pending" else None,
        "created_at": row.created_at,
        "snapshot_available": row.snapshot is not None,
        "snapshot": row.snapshot if snapshot else None,
        "review": None if row.reason_code == "moderation_disabled" else review,
    }


def page(rows, offset, limit, convert=lambda item: item):
    more = len(rows) > limit
    return {"items": [convert(r) for r in rows[:limit]], "next_offset": offset + limit if more else None}


def notify(db, actor_id, recipient_id, kind, thread_id, reply_id):
    users = lock_users(db, actor_id, recipient_id)
    if actor_id == recipient_id or len(users) < 2 or any(u.status != "active" for u in users):
        return
    if not blocked(db, actor_id, recipient_id):
        db.add(
            m.Notification(
                recipient_id=recipient_id,
                actor_id=actor_id,
                kind=kind,
                thread_id=thread_id,
                reply_id=reply_id,
            )
        )


def cancel_edits(db, action, target_id, reason="superseded"):
    column = (
        m.Submission.user_id
        if action == "edit_profile"
        else (m.Submission.reply_id if action == "edit_reply" else m.Submission.thread_id)
    )
    for item in db.scalars(
        select(m.Submission)
        .where(m.Submission.action == action, column == target_id, m.Submission.status.in_(OPEN))
        .with_for_update()
    ):
        item.status, item.reason_code, item.lease_token = "cancelled", reason, None
        item.lease_until, item.updated_at = None, m.now()
    db.flush()


def erase_content(db, row, state="deleted"):
    is_thread = isinstance(row, m.Thread)
    action = "edit_thread" if is_thread else "edit_reply"
    cancel_edits(db, action, row.id, "target_unavailable")
    row.state, row.revision, row.updated_at = state, row.revision + 1, m.now()
    if is_thread:
        row.accepted_reply_id, row.search_text = None, ""
    else:
        thread = require_row(db, m.Thread, row.thread_id, lock=True)
        if thread.accepted_reply_id == row.id:
            thread.accepted_reply_id = None
    if state == "deleted":
        row.body_markdown = None
        if is_thread:
            row.title = None
        col = m.Submission.thread_id if is_thread else m.Submission.reply_id
        actions = ["create_thread", "edit_thread"] if is_thread else ["create_reply", "edit_reply"]
        for sub in db.scalars(select(m.Submission).where(col == row.id, m.Submission.action.in_(actions))):
            sub.snapshot = None
        db.add(m.Erasure(target_type="thread" if is_thread else "reply", target_id=row.id, action="delete"))


def audit(db, user, action, target, reason):
    if not reason.strip():
        fail(422, "reason_required", "Enter a reason.")
    db.add(m.AdminAction(actor_id=user.id, action=action, target_id=str(target), reason=reason))


def rank_expr(vote_sum, published_at, stamp):
    return func.coalesce(vote_sum, 0) / func.sqrt(
        func.greatest(0, func.extract("epoch", stamp - published_at) / 3600) + 2
    )
