import os
from uuid import uuid4
import pytest
from sqlalchemy import text
from alembic import command
from alembic.config import Config

url = os.environ.get("TEST_DATABASE_URL", "")
if not url or not url.split("?")[0].endswith("_test"):
    raise RuntimeError("TEST_DATABASE_URL must name an isolated PostgreSQL database ending in _test")
os.environ["DATABASE_URL"] = url
os.environ["ENVIRONMENT"] = "test"
os.environ["MODERATION_MODE"] = "fixture"

from app.main import app  # noqa: E402
from app import auth, models as m  # noqa: E402
from app.db import engine, Session  # noqa: E402
from app.config import settings, Settings  # noqa: E402
from fastapi import Request  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def migrate():
    command.upgrade(Config("alembic.ini"), "head")
    yield
    engine.dispose()


@pytest.fixture(autouse=True)
def clean(migrate):
    with engine.begin() as db:
        names = [name for name in m.Base.metadata.tables if name != "topics"]
        db.execute(text("TRUNCATE " + ",".join(names) + " CASCADE"))
    settings().__dict__.update(Settings().__dict__)
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    def identity(request: Request):
        name = request.headers.get("x-test-user")
        return auth.Principal("https://synthetic.clerk.accounts.dev", "user_" + name) if name else None

    app.dependency_overrides[auth.principal] = identity
    with TestClient(app) as value:
        yield value


def headers(name):
    return {"x-test-user": name, "Idempotency-Key": str(uuid4())}


@pytest.fixture
def people(client):
    people = {}
    for name in ["alice", "bruce", "claire", "admin"]:
        res = client.post("/api/v1/me", json={"username": name}, headers=headers(name))
        assert res.status_code == 201, res.text
        people[name] = res.json()
    with Session() as db:
        db.get(m.User, people["admin"]["id"]).role = "admin"
        db.commit()
    return people


@pytest.fixture
def topic(client):
    return client.get("/api/v1/topics").json()[0]["id"]


def create_thread(client, topic, user="alice", **kwargs):
    body = {
        "type": "question",
        "topic_id": topic,
        "title": "How can I ask for help?",
        "body_markdown": "Office hours seem intimidating. Any advice?",
        **kwargs,
    }
    res = client.post("/api/v1/threads", json=body, headers=headers(user))
    assert res.status_code == 201, res.text
    return res.json()["content"]


def create_reply(client, thread, user="bruce", **kwargs):
    body = {"body_markdown": "Bring a specific question and explain what you tried.", **kwargs}
    res = client.post(f"/api/v1/threads/{thread['id']}/replies", json=body, headers=headers(user))
    assert res.status_code == 201, res.text
    return res.json()["content"]
