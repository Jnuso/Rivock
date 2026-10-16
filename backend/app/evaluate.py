"""Limited synthetic evaluation; live calls use the normal budgeted moderation service."""

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from sqlalchemy import select
from sqlalchemy.engine import make_url
from . import models as m, moderation as mod
from .config import settings
from .ai_costs import pricing_ready
from .db import Session

PACK = Path(__file__).resolve().parents[1] / "evaluation" / "benign-v1.json"
GAPS = ["threats", "targeted harassment", "hate", "privacy violations", "scams", "multilingual context"]


def cases():
    pack = json.loads(PACK.read_text(encoding="utf-8"))
    result = pack["cases"]
    for suffix, text in [
        ("repeat_ascii", "Promotion " + "x" * 110),
        ("repeat_unicode", "Promotion " + "\U0001f642" * 110),
        ("nine_urls", "Promotional pages: " + " ".join(f"https://example.invalid/ad/{n}" for n in range(9))),
    ]:
        result.append({"id": suffix, "category": "synthetic_spam", "text": text, "expected": "reject"})
    return result


def summarize(rows, live=False):
    return {
        "total": len(rows),
        "false_rejections": sum(r["expected"] == "allow" and r["decision"] == "reject" for r in rows),
        "rejected_violations": sum(r["expected"] == "reject" and r["decision"] == "reject" for r in rows),
        "published_violations": sum(
            r["expected"] == "reject" and r["decision"] in {"allow", "uncertain"} for r in rows
        ),
        "deferred": sum(r["decision"] == "defer" for r in rows),
        "live_model_evaluated": live,
    }


def evaluate(live=False, limit=None):
    items = cases()
    if limit is not None:
        if type(limit) is not int or not 1 <= limit <= len(items):
            raise RuntimeError("Evaluation limit must be between one and the pack size.")
        items = items[:limit]
    rows, provider_decisions, provider_attempts = [], 0, 0
    if live:
        cfg = settings()
        if cfg.environment != "test" or not (make_url(cfg.database_url).database or "").endswith("_test"):
            raise RuntimeError(
                "Live evaluation requires ENVIRONMENT=test and a disposable DATABASE_URL ending in _test."
            )
        if (
            cfg.moderation_mode != "google"
            or not cfg.ai_api_key
            or not cfg.ai_model
            or not pricing_ready(cfg)
        ):
            raise RuntimeError(
                "Configure the verified Google model, key and explicit free or metered pricing "
                "before live evaluation."
            )
        with Session() as db:
            mod.mutation_lock(db)
            topic = db.scalar(select(m.Topic).where(m.Topic.is_active).limit(1))
            if not topic:
                raise RuntimeError("Migrate the disposable database before evaluating.")
            actor = m.User(username="eval_" + m.uid().replace("-", "")[:12], kind="bot")
            db.add(actor)
            db.flush()
            actor_id, topic_id = actor.id, topic.id
            db.commit()
    for item in items:
        decision = mod.rules({"body_markdown": item["text"]})
        value, reason = decision if decision else ("defer", "requires_model")
        source = "rules"
        if live:
            with Session() as db:
                mod.mutation_lock(db)
                row = m.Submission(
                    user_id=actor_id,
                    action="create_thread",
                    idempotency_key=m.uid(),
                    request_hash=hashlib.sha256((actor_id + item["id"]).encode()).hexdigest(),
                    snapshot={
                        "type": "discussion",
                        "topic_id": topic_id,
                        "title": "Synthetic evaluation " + item["id"],
                        "body_markdown": item["text"],
                    },
                )
                db.add(row)
                db.commit()
                sid = row.id
            mod.process(sid)
            with Session() as db:
                row = db.get(m.Submission, sid)
                attempt = db.scalar(
                    select(m.Attempt)
                    .where(m.Attempt.submission_id == sid)
                    .order_by(m.Attempt.started_at.desc())
                    .limit(1)
                )
                value = (
                    attempt.decision
                    if attempt and attempt.decision in {"allow", "reject", "uncertain"}
                    else "defer"
                )
                reason, source = (
                    row.reason_code or row.error_category or "pending",
                    attempt.source if attempt else "pending",
                )
                provider_decisions += int(source == "ai" and value != "defer")
                provider_attempts += row.ai_attempt_count
        rows.append(
            {
                "id": item["id"],
                "category": item["category"],
                "expected": item["expected"],
                "decision": value,
                "reason": reason,
                "source": source,
            }
        )
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "pack": "rivock-benign-v1+synthetic-spam-v1",
        "dataset_sha256": hashlib.sha256(json.dumps(items, sort_keys=True).encode()).hexdigest(),
        "requested_adapter": "google" if live else "rules",
        "model": settings().ai_model if live else None,
        "billing_mode": settings().ai_billing_mode if live else None,
        "provider_attempts": provider_attempts,
        "coverage_gaps": GAPS,
        "summary": summarize(rows, provider_decisions > 0),
        "cases": rows,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--live",
        action="store_true",
        help="Call the configured model only in a disposable test database; normal budgets and pause apply.",
    )
    parser.add_argument("--output", type=Path)
    parser.add_argument("--limit", type=int, help="Evaluate only the first N cases for a bounded smoke test.")
    args = parser.parse_args()
    try:
        report = evaluate(args.live, args.limit)
    except RuntimeError as error:
        raise SystemExit(str(error)) from None
    rendered = json.dumps(report, indent=2) + "\n"
    if args.output:
        args.output.write_text(rendered, encoding="utf-8")
    else:
        print(rendered, end="")


if __name__ == "__main__":
    main()
