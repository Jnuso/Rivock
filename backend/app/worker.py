import time
from datetime import timedelta
from sqlalchemy import select, delete
from .db import Session
from . import models as m, moderation as mod, services as s


def cleanup():
    with Session() as db:
        mod.mutation_lock(db)
        stamp = m.now()
        for cls in [m.Thread, m.Reply]:
            for row in db.scalars(
                select(cls)
                .where(
                    cls.state == "removed",
                    cls.updated_at < stamp - timedelta(days=7),
                    cls.body_markdown.is_not(None),
                )
                .with_for_update()
            ):
                s.erase_content(db, row, "deleted")
                row.state = "removed"
        for row in db.scalars(select(m.Submission).where(m.Submission.snapshot.is_not(None))):
            if row.status in s.OPEN and row.created_at < stamp - timedelta(days=30):
                row.status, row.reason_code, row.lease_token, row.lease_until = (
                    "cancelled",
                    "draft_expired",
                    None,
                    None,
                )
                row.snapshot = None
            elif row.status not in s.OPEN and row.updated_at < stamp - timedelta(days=7):
                row.snapshot = None
        db.execute(delete(m.Notification).where(m.Notification.created_at < stamp - timedelta(days=90)))
        db.execute(delete(m.RateBucket).where(m.RateBucket.expires_at < stamp))
        # Metadata needed for safe idempotency and foreign keys remains; free text expires.
        for cls, field in [(m.Report, "detail"), (m.AdminAction, "reason")]:
            for row in db.scalars(select(cls).where(cls.created_at < stamp - timedelta(days=90))):
                setattr(row, field, "[retention expired]")
        cutoff = stamp - timedelta(days=365)
        db.execute(delete(m.Attempt).where(m.Attempt.started_at < cutoff))
        db.execute(delete(m.Report).where(m.Report.created_at < cutoff))
        db.execute(delete(m.AdminAction).where(m.AdminAction.created_at < cutoff))
        db.commit()


def once():
    started = time.monotonic()
    with Session() as db:
        ids = list(
            db.scalars(
                select(m.Submission.id)
                .where(
                    m.Submission.status.in_(["pending", "processing"]),
                    m.Submission.next_attempt_at <= m.now(),
                )
                .order_by(m.Submission.next_attempt_at)
                .limit(20)
            )
        )
    for sid in ids:
        if time.monotonic() - started > 35:
            break
        mod.process(sid)
    cleanup()


def main():
    import argparse

    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--once", action="store_true", help="Process a bounded queue batch and clean up")
    mode.add_argument(
        "--cleanup-only", action="store_true", help="Run retention cleanup once without processing submissions"
    )
    args = parser.parse_args()
    if args.cleanup_only:
        cleanup()
        return
    if args.once:
        once()
        return
    try:
        while True:
            once()
            time.sleep(5)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
