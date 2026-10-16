import pytest
from app.config import Settings, settings


@pytest.fixture(autouse=True)
def reset_configuration(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "test")
    settings.cache_clear()
    settings().__dict__.update(Settings(environment="test").__dict__)
    yield
    settings.cache_clear()
