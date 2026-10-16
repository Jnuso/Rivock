def test_runtime_has_no_test_auth_header(client, people):
    from app.main import app

    app.dependency_overrides.clear()
    assert client.get("/api/v1/me", headers={"x-test-user": "alice"}).status_code == 401
