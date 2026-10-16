import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.static_site import install_static_site


@pytest.fixture
def site(tmp_path):
    root = tmp_path / "site"
    root.mkdir()
    (root / "index.html").write_text("<!doctype html><title>Rivock test</title>")
    (root / "assets").mkdir()
    (root / "assets" / "app-123.js").write_text("console.log('synthetic');")
    (root / "staticwebapp.config.json").write_text(json.dumps({"globalHeaders": {
        "Content-Security-Policy": "default-src 'self'; object-src 'none'",
        "Permissions-Policy": "camera=()",
    }}))
    (tmp_path / "outside.txt").write_text("private")
    app = FastAPI(docs_url=None, openapi_url=None)

    @app.get("/api/v1/test")
    def api():
        return {"api": True}

    install_static_site(app, str(root))
    return TestClient(app)


def test_documents_assets_and_head(site):
    home = site.get("/")
    assert home.status_code == 200
    assert "Rivock test" in home.text
    assert home.headers["cache-control"] == "no-cache"
    assert "object-src 'none'" in home.headers["content-security-policy"]
    assert home.headers["permissions-policy"] == "camera=()"
    navigation = site.get("/threads/synthetic-id", headers={"accept": "text/html"})
    assert navigation.text == home.text
    asset = site.get("/assets/app-123.js")
    assert asset.status_code == 200
    assert "immutable" in asset.headers["cache-control"]
    head = site.head("/threads/synthetic-id", headers={"accept": "text/html"})
    assert head.status_code == 200 and not head.content
    assert head.headers["content-length"] == home.headers["content-length"]
    assert site.get("/api/v1/test").json() == {"api": True}


@pytest.mark.parametrize("path", [
    "/api/v1/missing", "/health/missing", "/docs", "/redoc", "/openapi.json",
    "/assets/missing.js", "/assets/missing", "/fonts/missing", "/missing.svg",
    "/.env", "/%2e%2e/outside.txt", "/assets/%2e%2e/%2e%2e/outside.txt",
    "/assets%5c..%5cindex.html", "/staticwebapp.config.json", "/bad%00path",
])
def test_never_fall_back_for_private_or_missing_resources(site, path):
    response = site.get(path, headers={"accept": "text/html"})
    assert response.status_code == 404
    assert "private" not in response.text and "Rivock test" not in response.text


def test_non_document_requests_and_writes_do_not_get_spa(site):
    assert site.get("/threads/synthetic-id", headers={"accept": "application/json"}).status_code == 404
    assert site.post("/threads/synthetic-id").status_code == 405


def test_missing_build_fails_startup(tmp_path):
    with pytest.raises(RuntimeError, match="missing index"):
        install_static_site(FastAPI(), str(tmp_path))
