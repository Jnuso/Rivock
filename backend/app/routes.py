from typing import Annotated, Literal
from uuid import UUID
from fastapi import APIRouter, Depends, Header, Query, Request, Response
from sqlalchemy import select, func, delete, case
from sqlalchemy.dialects.postgresql import insert
from . import models as m, schemas as v, services as s, moderation as mod, auth
from .db import get_db

DB = Annotated[object, Depends(get_db)]
Viewer = Annotated[object, Depends(auth.viewer)]
Member = Annotated[object, Depends(auth.member)]
Limit = Annotated[int, Query(ge=1, le=50)]
Offset = Annotated[int, Query(ge=0, le=10000)]
Key = Annotated[str | None, Header(alias="Idempotency-Key")]


def read_budget(request: Request, db: DB, user: Viewer):
    if request.method in {"GET", "HEAD"}:
        s.read_rate(db, request, user)
        db.commit()


ERROR_RESPONSES = {code: {"model": v.ErrorOut} for code in [401, 403, 404, 409, 422, 429, 503]}
router = APIRouter(prefix="/api/v1", dependencies=[Depends(read_budget)], responses=ERROR_RESPONSES)


@router.get("/info", response_model=v.InfoOut)
def info():
    from .config import settings

    return {
        "local_fixture_moderation": settings().environment in {"local", "test"}
        and settings().moderation_mode == "fixture"
    }


def finish(db, user, action, body, key, response, target=None):
    sid = mod.submit(db, user, action, body, key, target)
    mod.process(sid)
    code, value = mod.outcome(db, sid, user)
    response.status_code = code
    return value


@router.get("/me", response_model=v.MeOut)
def me(db: DB, identity=Depends(auth.required_principal)):
    user = db.scalar(
        select(m.User).where(m.User.auth_issuer == identity.issuer, m.User.auth_subject == identity.subject)
    )
    return {"onboarding_required": user is None, "user": s.private_user(user) if user else None}


@router.post("/me", response_model=v.PrivateUser, status_code=201)
def onboard(
    body: v.Onboard,
    db: DB,
    response: Response,
    idempotency_key: Key = None,
    identity=Depends(auth.required_principal),
):
    mod.mutation_lock(db)
    try:
        UUID(idempotency_key)
    except (ValueError, TypeError):
        s.fail(422, "idempotency_required", "Send an Idempotency-Key UUID header.")
    user = db.scalar(
        select(m.User).where(m.User.auth_issuer == identity.issuer, m.User.auth_subject == identity.subject)
    )
    if user:
        if user.username != body.username:
            s.fail(409, "already_onboarded", "Your username is already set.")
        response.status_code = 200
        return s.private_user(user)
    if db.scalar(select(m.User.id).where(m.User.username == body.username)):
        s.fail(409, "username_taken", "Choose another username.")
    user = m.User(username=body.username, auth_issuer=identity.issuer, auth_subject=identity.subject)
    db.add(user)
    db.flush()
    return s.private_user(user)


@router.patch("/me", response_model=v.MutationOut, responses={202: {"model": v.MutationOut}})
def edit_me(body: v.ProfileEdit, db: DB, user: Member, response: Response, idempotency_key: Key = None):
    return finish(db, user, "edit_profile", body.model_dump(mode="json"), idempotency_key, response, user.id)


@router.delete("/me", status_code=204)
def deactivate(body: v.Deactivate, db: DB, identity=Depends(auth.required_principal)):
    mod.mutation_lock(db)
    user = db.scalar(
        select(m.User)
        .where(m.User.auth_issuer == identity.issuer, m.User.auth_subject == identity.subject)
        .with_for_update()
    )
    if not user or user.username != body.confirm_username:
        s.fail(422, "confirmation_required", "Enter your username to confirm.")
    if user.status == "deactivated":
        return
    if (
        user.role == "admin"
        and db.scalar(
            select(func.count()).select_from(m.User).where(m.User.role == "admin", m.User.status == "active")
        )
        <= 1
    ):
        s.fail(409, "last_admin", "Assign another active admin before deactivating.")
    user.status, user.bio, user.avatar_key = "deactivated", "", "initials"
    user.profile_revision += 1
    user.updated_at = m.now()
    for row in db.scalars(select(m.Submission).where(m.Submission.user_id == user.id)):
        if row.status in s.OPEN:
            row.status, row.reason_code, row.lease_token = "cancelled", "account_inactive", None
        row.snapshot = None
    for cls, col in [
        (m.Save, m.Save.user_id),
        (m.Block, m.Block.blocker_id),
        (m.Notification, m.Notification.recipient_id),
    ]:
        db.execute(delete(cls).where(col == user.id))
    db.add(m.Erasure(target_type="user", target_id=user.id, action="deactivate"))


@router.get("/topics", response_model=list[v.TopicOut])
def topics(db: DB, include_archived: bool = False):
    stmt = select(m.Topic)
    if not include_archived:
        stmt = stmt.where(m.Topic.is_active)
    return list(db.scalars(stmt.order_by(m.Topic.sort_order, m.Topic.slug)))


@router.get("/threads", response_model=v.ThreadList)
def feed(
    db: DB,
    user: Viewer,
    limit: Limit = 20,
    offset: Offset = 0,
    topic: str | None = None,
    q: Annotated[str, Query(max_length=200)] = "",
    sort: str | None = None,
):
    q = q.strip()
    sort = sort or ("relevance" if q else "trending")
    if sort not in ({"relevance", "newest"} if q else {"trending", "latest"}):
        s.fail(422, "invalid_sort", "Choose a supported sort for this search.")
    votes = (
        select(m.ThreadVote.thread_id, func.sum(m.ThreadVote.value).label("score"))
        .group_by(m.ThreadVote.thread_id)
        .subquery()
    )
    stmt = (
        select(m.Thread)
        .outerjoin(votes, votes.c.thread_id == m.Thread.id)
        .where(m.Thread.state == "published", m.Thread.author_id.not_in(s.hidden_ids(db, user)))
    )
    if topic:
        stmt = stmt.join(m.Topic).where(m.Topic.slug == topic)
    if q:
        query = func.websearch_to_tsquery("english", q)
        stmt = stmt.where(m.Thread.search_vector.op("@@")(query))
        if sort == "relevance":
            stmt = stmt.order_by(func.ts_rank_cd(m.Thread.search_vector, query).desc())
    elif sort == "trending":
        stmt = stmt.order_by(s.rank_expr(votes.c.score, m.Thread.published_at, m.now()).desc())
    rows = list(
        db.scalars(
            stmt.order_by(m.Thread.published_at.desc(), m.Thread.id.desc()).offset(offset).limit(limit + 1)
        )
    )
    return s.page(rows, offset, limit, lambda row: s.thread_out(db, row, user, False))


@router.get("/threads/{id}", response_model=v.ThreadOut)
def thread(id: UUID, db: DB, user: Viewer):
    return s.thread_out(db, s.require_row(db, m.Thread, id), user)


@router.post(
    "/threads", response_model=v.MutationOut, status_code=201, responses={202: {"model": v.MutationOut}}
)
def create_thread(
    body: v.ThreadCreate, db: DB, user: Member, response: Response, idempotency_key: Key = None
):
    return finish(db, user, "create_thread", body.model_dump(mode="json"), idempotency_key, response)


@router.patch("/threads/{id}", response_model=v.MutationOut, responses={202: {"model": v.MutationOut}})
def edit_thread(
    id: UUID, body: v.ThreadEdit, db: DB, user: Member, response: Response, idempotency_key: Key = None
):
    return finish(db, user, "edit_thread", body.model_dump(mode="json"), idempotency_key, response, str(id))


@router.delete("/threads/{id}", status_code=204)
def delete_thread(id: UUID, db: DB, user: Member):
    row = s.require_row(db, m.Thread, id, lock=True)
    s.owned(row, user)
    if row.state != "deleted":
        s.erase_content(db, row)


@router.get("/threads/{id}/replies", response_model=v.ReplyList)
def replies(id: UUID, db: DB, user: Viewer, limit: Limit = 20, offset: Offset = 0):
    parent = s.require_row(db, m.Thread, id)
    # Keep shells for unavailable ancestors so other people's responses stay reachable.
    votes = (
        select(m.ReplyVote.reply_id, func.sum(m.ReplyVote.value).label("score"))
        .group_by(m.ReplyVote.reply_id)
        .subquery()
    )
    stmt = (
        select(m.Reply)
        .outerjoin(votes, votes.c.reply_id == m.Reply.id)
        .where(m.Reply.thread_id == str(id), m.Reply.parent_reply_id.is_(None))
    )
    hidden = s.hidden_ids(db, user)
    answer = db.get(m.Reply, parent.accepted_reply_id) if parent.accepted_reply_id else None
    accepted = (
        answer.id
        if answer
        and answer.state == "published"
        and answer.author_id not in hidden
        and parent.state == "published"
        and parent.author_id not in hidden
        else None
    )
    visible_rank = case(
        (
            m.Reply.state == "published",
            case(
                (m.Reply.author_id.not_in(hidden), s.rank_expr(votes.c.score, m.Reply.published_at, m.now())),
                else_=None,
            ),
        ),
        else_=None,
    )
    stmt = stmt.order_by(
        (m.Reply.id == accepted).desc(),
        visible_rank.desc().nulls_last(),
        m.Reply.published_at.desc(),
        m.Reply.id.desc(),
    )
    return s.page(
        list(db.scalars(stmt.offset(offset).limit(limit + 1))),
        offset,
        limit,
        lambda row: s.reply_out(db, row, user),
    )


@router.get("/replies/{id}/children", response_model=v.ReplyList)
def children(id: UUID, db: DB, user: Viewer, limit: Limit = 20, offset: Offset = 0):
    s.require_row(db, m.Reply, id)
    rows = list(
        db.scalars(
            select(m.Reply)
            .where(m.Reply.parent_reply_id == str(id))
            .order_by(m.Reply.published_at, m.Reply.id)
            .offset(offset)
            .limit(limit + 1)
        )
    )
    return s.page(rows, offset, limit, lambda row: s.reply_out(db, row, user))


@router.get("/replies/{id}", response_model=v.ReplyOut)
def reply(id: UUID, db: DB, user: Viewer):
    return s.reply_out(db, s.require_row(db, m.Reply, id), user)


@router.get("/replies/{id}/context", response_model=v.ReplyContextOut)
def reply_context(id: UUID, db: DB, user: Viewer):
    row = s.require_row(db, m.Reply, id)
    thread_id, chain, seen = row.thread_id, [], set()
    while row:
        if row.id in seen or len(chain) >= 5 or row.thread_id != thread_id:
            s.fail(404, "context_unavailable", "This reply context is unavailable.")
        seen.add(row.id)
        chain.append(s.reply_out(db, row, user))
        row = s.require_row(db, m.Reply, row.parent_reply_id) if row.parent_reply_id else None
    return {"thread_id": thread_id, "replies": list(reversed(chain))}


@router.post(
    "/threads/{id}/replies",
    response_model=v.MutationOut,
    status_code=201,
    responses={202: {"model": v.MutationOut}},
)
def create_reply(
    id: UUID, body: v.ReplyCreate, db: DB, user: Member, response: Response, idempotency_key: Key = None
):
    data = {**body.model_dump(mode="json"), "thread_id": str(id)}
    return finish(db, user, "create_reply", data, idempotency_key, response)


@router.patch("/replies/{id}", response_model=v.MutationOut, responses={202: {"model": v.MutationOut}})
def edit_reply(
    id: UUID, body: v.ReplyEdit, db: DB, user: Member, response: Response, idempotency_key: Key = None
):
    return finish(db, user, "edit_reply", body.model_dump(mode="json"), idempotency_key, response, str(id))


@router.delete("/replies/{id}", status_code=204)
def delete_reply(id: UUID, db: DB, user: Member):
    row = s.require_row(db, m.Reply, id, lock=True)
    s.owned(row, user)
    if row.state != "deleted":
        s.erase_content(db, row)


def vote(db, user, cls, vote_cls, target, value):
    row = s.require_row(db, cls, target, lock=True)
    thread = row if cls == m.Thread else s.require_row(db, m.Thread, row.thread_id, True)
    if row.state != "published" or thread.state != "published":
        s.fail(409, "target_unavailable", "This contribution is unavailable for voting.")
    s.interact(db, user, row.author_id)
    if row.author_id == user.id:
        s.fail(403, "self_vote", "You cannot vote on your own contribution.")
    s.rate(db, user.id, "vote_minute", 60, 60)
    s.rate(db, user.id, "vote_day", 500, 86400)
    col = vote_cls.thread_id if cls == m.Thread else vote_cls.reply_id
    if value is None:
        db.execute(delete(vote_cls).where(vote_cls.user_id == user.id, col == row.id))
    else:
        stmt = insert(vote_cls).values(user_id=user.id, **{col.key: row.id}, value=value)
        db.execute(stmt.on_conflict_do_update(index_elements=[vote_cls.user_id, col], set_={"value": value}))
    db.flush()
    return {
        "score": db.scalar(select(func.coalesce(func.sum(vote_cls.value), 0)).where(col == row.id)),
        "my_vote": value,
    }


@router.put("/threads/{id}/vote", response_model=v.VoteOut)
def vote_thread(id: UUID, body: v.VoteIn, db: DB, user: Member):
    return vote(db, user, m.Thread, m.ThreadVote, id, body.value)


@router.delete("/threads/{id}/vote", response_model=v.VoteOut)
def unvote_thread(id: UUID, db: DB, user: Member):
    return vote(db, user, m.Thread, m.ThreadVote, id, None)


@router.put("/replies/{id}/vote", response_model=v.VoteOut)
def vote_reply(id: UUID, body: v.VoteIn, db: DB, user: Member):
    return vote(db, user, m.Reply, m.ReplyVote, id, body.value)


@router.delete("/replies/{id}/vote", response_model=v.VoteOut)
def unvote_reply(id: UUID, db: DB, user: Member):
    return vote(db, user, m.Reply, m.ReplyVote, id, None)


def acceptance(db, user, id, reply_id=None):
    row = s.require_row(db, m.Thread, id, True)
    s.owned(row, user)
    if row.state != "published" or row.type != "question":
        s.fail(409, "not_available", "Only a published question can have an accepted answer.")
    if reply_id:
        answer = s.require_row(db, m.Reply, reply_id, True)
        if answer.thread_id != row.id or answer.parent_reply_id or answer.state != "published":
            s.fail(422, "invalid_answer", "Choose a published direct answer to this question.")
        s.interact(db, user, answer.author_id)
        if row.accepted_reply_id != answer.id:
            s.notify(db, user.id, answer.author_id, "answer_accepted", row.id, answer.id)
    row.accepted_reply_id = str(reply_id) if reply_id else None
    return {"accepted_reply_id": row.accepted_reply_id}


@router.put("/threads/{id}/accepted-answer", response_model=v.AcceptedOut)
def accept(id: UUID, body: v.AcceptIn, db: DB, user: Member):
    return acceptance(db, user, id, body.reply_id)


@router.delete("/threads/{id}/accepted-answer", response_model=v.AcceptedOut)
def unaccept(id: UUID, db: DB, user: Member):
    return acceptance(db, user, id)


@router.put("/threads/{id}/save", status_code=204)
def save(id: UUID, db: DB, user: Member):
    row = s.require_row(db, m.Thread, id)
    if row.state != "published" or row.author_id in s.hidden_ids(db, user):
        s.fail(409, "target_unavailable", "This thread is unavailable.")
    db.execute(insert(m.Save).values(user_id=user.id, thread_id=row.id).on_conflict_do_nothing())


@router.delete("/threads/{id}/save", status_code=204)
def unsave(id: UUID, db: DB, user: Member):
    db.execute(delete(m.Save).where(m.Save.user_id == user.id, m.Save.thread_id == str(id)))


@router.get("/me/saved", response_model=v.ThreadList)
def saved(db: DB, user: Member, limit: Limit = 20, offset: Offset = 0):
    rows = list(
        db.scalars(
            select(m.Thread)
            .join(m.Save)
            .where(m.Save.user_id == user.id)
            .order_by(m.Save.created_at.desc(), m.Thread.id)
            .offset(offset)
            .limit(limit + 1)
        )
    )
    return s.page(rows, offset, limit, lambda row: s.thread_out(db, row, user, False))


def profile(db, username, user):
    row = db.scalar(select(m.User).where(m.User.username == username.lower(), m.User.status != "deactivated"))
    if not row or row.id in s.hidden_ids(db, user):
        s.fail(404, "not_found", "This profile is unavailable.")
    return row


@router.get("/users/{username}", response_model=v.PublicUser)
def user_profile(username: str, db: DB, user: Viewer):
    return s.public_user(profile(db, username, user))


@router.get("/users/{username}/contributions", response_model=v.ContributionList)
def contributions(
    username: str,
    db: DB,
    user: Viewer,
    type: Literal["threads", "replies"] = "threads",
    limit: Limit = 20,
    offset: Offset = 0,
):
    author = profile(db, username, user)
    cls = m.Thread if type == "threads" else m.Reply
    stmt = select(cls).where(cls.author_id == author.id, cls.state == "published")
    # Replies under an unavailable thread are reachable only through its conversation shell.
    if cls == m.Reply:
        stmt = stmt.join(m.Thread).where(
            m.Thread.state == "published", m.Thread.author_id.not_in(s.hidden_ids(db, user))
        )
    rows = list(db.scalars(stmt.order_by(cls.published_at.desc(), cls.id).offset(offset).limit(limit + 1)))
    return s.page(
        rows,
        offset,
        limit,
        lambda r: s.thread_out(db, r, user, False) if cls == m.Thread else s.reply_out(db, r, user),
    )


@router.get("/me/submissions", response_model=v.SubmissionList)
def submissions(db: DB, user: Member, status: str | None = None, limit: Limit = 20, offset: Offset = 0):
    stmt = select(m.Submission).where(m.Submission.user_id == user.id)
    if status:
        stmt = stmt.where(m.Submission.status == status)
    return s.submission_page(
        db,
        list(
            db.scalars(
                stmt.order_by(m.Submission.created_at.desc(), m.Submission.id).offset(offset).limit(limit + 1)
            )
        ),
        offset,
        limit,
    )


@router.get("/me/submissions/{id}", response_model=v.SubmissionOut)
def submission(id: UUID, db: DB, user: Member):
    row = s.require_row(db, m.Submission, id)
    if row.user_id != user.id:
        s.fail(404, "not_found", "This submission is unavailable.")
    return s.submission_out(row, True, review=s.submission_reviews(db, [row.id]).get(row.id))


@router.delete("/me/submissions/{id}", status_code=204)
def cancel_submission(id: UUID, db: DB, user: Member):
    row = s.require_row(db, m.Submission, id, True)
    if row.user_id != user.id:
        s.fail(404, "not_found", "This submission is unavailable.")
    if row.status == "cancelled":
        return
    if row.status not in s.OPEN:
        s.fail(409, "terminal_submission", "This submission is already complete.")
    row.status, row.reason_code, row.lease_token, row.lease_until = "cancelled", "owner_cancelled", None, None


def notification_stmt(db, user):
    # Both directions suppress events. Keep list and count on this identical predicate.
    excluded = set(db.scalars(select(m.Block.blocked_id).where(m.Block.blocker_id == user.id)))
    excluded.update(db.scalars(select(m.Block.blocker_id).where(m.Block.blocked_id == user.id)))
    return select(m.Notification).where(
        m.Notification.recipient_id == user.id, m.Notification.actor_id.not_in(excluded)
    )


def notification_out(db, row, user):
    thread, reply = db.get(m.Thread, row.thread_id), db.get(m.Reply, row.reply_id)
    available = (
        thread.state == "published"
        and reply.state == "published"
        and thread.author_id not in s.hidden_ids(db, user)
        and reply.author_id not in s.hidden_ids(db, user)
    )
    verb = {
        "thread_reply": "replied to your thread",
        "reply_response": "replied to you",
        "answer_accepted": "accepted your answer",
    }.get(row.kind, "updated a conversation")
    actor = s.public_user(db.get(m.User, row.actor_id))
    return {
        "id": row.id,
        "kind": row.kind,
        "read": row.read_at is not None,
        "created_at": row.created_at,
        "actor": actor,
        "target_type": "thread" if available else None,
        "target_id": thread.id if available else None,
        "reply_id": reply.id if available else None,
        "summary": f"{actor['username']} {verb}" if available else "This conversation is unavailable.",
        "available": available,
    }


@router.get("/me/notifications", response_model=v.NotificationList)
def notifications(db: DB, user: Member, unread_only: bool = False, limit: Limit = 20, offset: Offset = 0):
    stamp = m.now()
    stmt = notification_stmt(db, user).where(m.Notification.created_at <= stamp)
    if unread_only:
        stmt = stmt.where(m.Notification.read_at.is_(None))
    result = s.page(
        list(
            db.scalars(
                stmt.order_by(m.Notification.created_at.desc(), m.Notification.id)
                .offset(offset)
                .limit(limit + 1)
            )
        ),
        offset,
        limit,
        lambda r: notification_out(db, r, user),
    )
    return {**result, "as_of": stamp}


@router.get("/me/notifications/unread-count", response_model=v.CountOut)
def unread(db: DB, user: Member):
    stmt = notification_stmt(db, user).where(m.Notification.read_at.is_(None)).subquery()
    return {"count": db.scalar(select(func.count()).select_from(stmt))}


@router.patch("/me/notifications/{id}", response_model=v.NotificationOut)
def read_notification(id: UUID, body: v.ReadIn, db: DB, user: Member):
    row = db.scalar(notification_stmt(db, user).where(m.Notification.id == str(id)))
    if not row:
        s.fail(404, "not_found", "This notification is unavailable.")
    row.read_at = row.read_at or m.now()
    return notification_out(db, row, user)


@router.post("/me/notifications/read-all", status_code=204)
def read_all(body: v.ReadAll, db: DB, user: Member):
    if body.through.tzinfo is None or body.through > m.now():
        s.fail(422, "invalid_cutoff", "Use the notification list timestamp.")
    for row in db.scalars(
        notification_stmt(db, user).where(
            m.Notification.created_at <= body.through, m.Notification.read_at.is_(None)
        )
    ):
        row.read_at = m.now()


@router.get("/me/blocks", response_model=list[v.BlockOut])
def blocks(db: DB, user: Member):
    return [
        {"user_id": b.blocked_id, "username": s.public_user(u)["username"], "created_at": b.created_at}
        for b, u in db.execute(
            select(m.Block, m.User)
            .join(m.User, m.Block.blocked_id == m.User.id)
            .where(m.Block.blocker_id == user.id)
            .order_by(m.Block.created_at.desc())
        )
    ]


@router.put("/me/blocks/{id}", status_code=204)
def block(id: UUID, db: DB, user: Member):
    target = s.require_row(db, m.User, id)
    if target.id == user.id:
        s.fail(422, "self_block", "Choose a different user.")
    s.rate(db, user.id, "block", 30, 3600)
    db.execute(insert(m.Block).values(blocker_id=user.id, blocked_id=target.id).on_conflict_do_nothing())


@router.delete("/me/blocks/{id}", status_code=204)
def unblock(id: UUID, db: DB, user: Member):
    db.execute(delete(m.Block).where(m.Block.blocker_id == user.id, m.Block.blocked_id == str(id)))


def report_out(row):
    return {
        key: getattr(row, key)
        for key in ["id", "status", "reason", "detail", "created_at", "thread_id", "reply_id"]
    } | {"user_id": row.subject_user_id}


@router.post("/reports", response_model=v.ReportOut, status_code=201)
def report(body: v.ReportIn, db: DB, user: Member):
    targets = [(m.Thread, body.thread_id), (m.Reply, body.reply_id), (m.User, body.user_id)]
    if sum(key is not None for _, key in targets) != 1:
        s.fail(422, "one_target", "Report exactly one contribution or user.")
    cls, key = next((cls, key) for cls, key in targets if key is not None)
    target = s.require_row(db, cls, key)
    if (cls != m.User and target.state != "published") or (cls == m.User and target.status == "deactivated"):
        s.fail(404, "not_found", "This target is unavailable.")
    if (target.id if cls == m.User else target.author_id) in s.hidden_ids(db, user):
        s.fail(404, "not_found", "This target is unavailable.")
    s.rate(db, user.id, "report_hour", 5, 3600)
    s.rate(db, user.id, "report_day", 20, 86400)
    col = {m.Thread: m.Report.thread_id, m.Reply: m.Report.reply_id, m.User: m.Report.subject_user_id}[cls]
    if db.scalar(select(m.Report.id).where(m.Report.reporter_id == user.id, col == str(key))):
        s.fail(409, "duplicate_report", "You already reported this item.")
    row = m.Report(reporter_id=user.id, **{col.key: str(key)}, reason=body.reason, detail=body.detail)
    db.add(row)
    db.flush()
    return report_out(row)
