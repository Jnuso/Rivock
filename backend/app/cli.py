import argparse
import json
from pathlib import Path
from uuid import UUID
from sqlalchemy import select
from .db import Session
from . import models as m, moderation as mod, services as s
from .config import settings

TOPICS = [
    ("education", "Education"),
    ("relationships", "Relationships"),
    ("careers", "Careers"),
    ("money", "Money"),
    ("health-wellbeing", "Health & Wellbeing"),
    ("hobbies", "Hobbies"),
    ("everyday-life", "Everyday Life"),
]


def seed():
    if settings().environment == "production":
        raise SystemExit("Fictional seed command is restricted to local/test environments")
    with Session() as db:
        mod.mutation_lock(db)
        if db.scalar(select(m.User.id).where(m.User.username == "demo_maya")):
            print("Fictional seed already exists")
            return
        maya = m.User(
            username="demo_maya",
            kind="bot",
            bio="Fictional demo account. Conversations are original examples.",
        )
        ellis = m.User(
            username="demo_ellis", kind="bot", bio="Fictional demo account. No automated activity."
        )
        db.add_all([maya, ellis])
        db.flush()
        samples = [
            (
                "education",
                "question",
                "How do you ask for help before you fall behind?",
                "I understand the lectures, then freeze on the problem sets. Office hours feel intimidating. What helped you make the first visit?",
                "Bring one problem and show where you got stuck. You don’t need a perfect question—getting unstuck is the point of office hours.",
            ),
            (
                "money",
                "discussion",
                "Small habits that made your student budget easier",
                "My biggest change was planning three simple meals before shopping. What’s a small change you actually kept doing?",
                None,
            ),
            (
                "careers",
                "question",
                "What belongs on a résumé before your first internship?",
                "I have class projects and a part-time job, but no internship yet. How would you describe that experience clearly?",
                None,
            ),
            (
                "relationships",
                "discussion",
                "How do you make time for friends during a busy semester?",
                "Everyone’s schedule is different this year. I’m looking for low-pressure ways to stay connected.",
                None,
            ),
            (
                "hobbies",
                "question",
                "A hobby that fits into twenty minutes between classes?",
                "I want something that gets me away from scrolling without needing lots of equipment. What have you enjoyed?",
                None,
            ),
        ]
        for slug, kind, title, body, answer in samples:
            topic = db.scalar(select(m.Topic).where(m.Topic.slug == slug))
            row = m.Thread(
                author_id=maya.id,
                topic_id=topic.id,
                type=kind,
                title=title,
                body_markdown=body,
                search_text=s.plain(body),
            )
            db.add(row)
            db.flush()
            if answer:
                reply = m.Reply(thread_id=row.id, author_id=ellis.id, body_markdown=answer)
                db.add(reply)
                db.flush()
                row.accepted_reply_id = reply.id
        db.commit()
    print("Added five original fictional demo threads (visibly labeled authors)")


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("seed")
    admin = sub.add_parser("grant-admin")
    admin.add_argument("user_id", type=UUID)
    admin.add_argument("--reason", required=True)
    export = sub.add_parser("export-openapi")
    export.add_argument("path")
    journal = sub.add_parser("export-erasure")
    journal.add_argument("path")
    replay = sub.add_parser("replay-erasure")
    replay.add_argument("path")
    args = parser.parse_args()
    if args.command == "seed":
        seed()
    elif args.command == "export-openapi":
        from .main import app

        Path(args.path).write_text(json.dumps(app.openapi(), indent=2) + "\n", encoding="utf-8")
    elif args.command == "grant-admin":
        with Session() as db:
            mod.mutation_lock(db)
            user = s.require_row(db, m.User, args.user_id, True)
            if user.status != "active" or not args.reason.strip():
                raise SystemExit("An active local user and reason are required")
            user.role = "admin"
            s.audit(db, user, "operator_grant_admin", user.id, args.reason)
            db.commit()
        print("Admin role assigned to the named local user")
    elif args.command == "export-erasure":
        with Session() as db:
            rows = [
                {"id": r.id, "target_type": r.target_type, "target_id": r.target_id, "action": r.action}
                for r in db.scalars(select(m.Erasure).order_by(m.Erasure.created_at))
            ]
        Path(args.path).write_text(json.dumps(rows, indent=2) + "\n", encoding="utf-8")
    else:
        rows = json.loads(Path(args.path).read_text(encoding="utf-8"))
        with Session() as db:
            mod.mutation_lock(db)
            for marker in rows:
                if marker["target_type"] in {"thread", "reply"}:
                    cls = m.Thread if marker["target_type"] == "thread" else m.Reply
                    row = db.get(cls, marker["target_id"])
                    if row:
                        s.erase_content(db, row)
                elif marker["target_type"] == "user":
                    user = db.get(m.User, marker["target_id"])
                    if user:
                        user.bio = ""
                        user.profile_revision += 1
                        s.cancel_edits(db, "edit_profile", user.id, "erasure_replay")
                        for submission in db.scalars(
                            select(m.Submission).where(m.Submission.user_id == user.id)
                        ):
                            if submission.action == "edit_profile" or marker["action"] == "deactivate":
                                submission.snapshot = None
                            if marker["action"] == "deactivate" and submission.status in s.OPEN:
                                submission.status, submission.lease_token, submission.lease_until = (
                                    "cancelled",
                                    None,
                                    None,
                                )
                        if marker["action"] == "deactivate":
                            from sqlalchemy import delete

                            user.status, user.avatar_key = "deactivated", "initials"
                            for cls, col in [
                                (m.Notification, m.Notification.recipient_id),
                                (m.Save, m.Save.user_id),
                                (m.Block, m.Block.blocker_id),
                            ]:
                                db.execute(delete(cls).where(col == user.id))
            db.commit()
        print("Applied erasure markers; run cleanup before reopening access")


if __name__ == "__main__":
    main()
