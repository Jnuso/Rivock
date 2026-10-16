"""Isolated PostgreSQL restore/erasure drill. Refuses non-test databases. Never uses production data."""
import argparse
import os
from pathlib import Path
import shutil
import subprocess
import sys
from uuid import uuid4
import psycopg
from sqlalchemy.engine import make_url

parser = argparse.ArgumentParser()
parser.add_argument("--pg-bin", default="")
parser.add_argument("--output", required=True)
args = parser.parse_args()
source = os.environ["TEST_DATABASE_URL"]
target = os.environ["RESTORE_TEST_DATABASE_URL"]
for url in [source, target]:
    if not make_url(url).database.endswith("_test"):
        raise SystemExit("Refusing to operate on any database not ending in _test")
if source == target:
    raise SystemExit("Source and restored database must differ")
os.environ["DATABASE_URL"] = source
os.environ["ENVIRONMENT"] = "test"
os.environ["MODERATION_MODE"] = "fixture"
from app.db import Session  # noqa: E402
from app import models as m, services as s, moderation as mod  # noqa: E402


def binary(name):
    value = str(Path(args.pg_bin) / name) if args.pg_bin else shutil.which(name)
    if not value:
        raise SystemExit(f"Install PostgreSQL 17 client tools: {name} missing")
    return value


output = Path(args.output)
output.mkdir(parents=True, exist_ok=True)
dump, journal = output / "synthetic.dump", output / "erasure.json"
backend = Path(__file__).resolve().parents[1] / "backend"
subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], cwd=backend, check=True)
with Session() as db:
    mod.mutation_lock(db)
    user = m.User(username="drill_" + uuid4().hex[:12], kind="bot")
    db.add(user)
    db.flush()
    row = m.Thread(author_id=user.id, topic_id="00000000-0000-0000-0000-000000000001", type="question",
                   title="Synthetic restore drill", body_markdown="Text that must stay erased", search_text="Text that must stay erased")
    db.add(row)
    db.flush()
    reply = m.Reply(thread_id=row.id, author_id=user.id, body_markdown="Other conversation text stays")
    db.add(reply)
    db.commit()
    thread_id, reply_id = row.id, reply.id

subprocess.run([binary("pg_dump"), "--format=custom", "--no-owner", "--no-acl", "--file", str(dump),
                source.replace("postgresql+psycopg:", "postgresql:")], check=True)
with Session() as db:
    mod.mutation_lock(db)
    s.erase_content(db, db.get(m.Thread, thread_id))
    db.commit()
subprocess.run([sys.executable, "-m", "app.cli", "export-erasure", str(journal.resolve())], cwd=backend, check=True)
subprocess.run([binary("pg_restore"), "--clean", "--if-exists", "--no-owner", "--no-acl", "--exit-on-error",
                "--dbname", target.replace("postgresql+psycopg:", "postgresql:"), str(dump)], check=True)
env = dict(os.environ, DATABASE_URL=target)
subprocess.run([sys.executable, "-m", "app.cli", "replay-erasure", str(journal.resolve())], cwd=backend, env=env, check=True)
with psycopg.connect(target.replace("postgresql+psycopg:", "postgresql:")) as db:
    state, title, body = db.execute("select state,title,body_markdown from threads where id=%s", (thread_id,)).fetchone()
    assert state == "deleted" and title is None and body is None
    assert db.execute("select body_markdown from replies where id=%s", (reply_id,)).fetchone()[0] == "Other conversation text stays"
print("PASS: restored synthetic PostgreSQL backup; replayed later erasure; preserved other replies")
