import sys
from unittest.mock import Mock

import pytest

from app import worker


def test_cleanup_only_never_processes_submissions_or_sleeps(monkeypatch):
    cleanup = Mock()
    process = Mock(side_effect=AssertionError("Moderation must not run"))
    once = Mock(side_effect=AssertionError("The queue must not run"))
    sleep = Mock(side_effect=AssertionError("Cleanup must exit after one run"))
    monkeypatch.setattr(sys, "argv", ["worker", "--cleanup-only"])
    monkeypatch.setattr(worker, "cleanup", cleanup)
    monkeypatch.setattr(worker, "once", once)
    monkeypatch.setattr(worker.mod, "process", process)
    monkeypatch.setattr(worker.time, "sleep", sleep)

    worker.main()

    cleanup.assert_called_once_with()
    once.assert_not_called()
    process.assert_not_called()
    sleep.assert_not_called()


def test_once_keeps_its_existing_bounded_batch_entry_point(monkeypatch):
    once = Mock()
    cleanup = Mock(side_effect=AssertionError("once owns its cleanup"))
    monkeypatch.setattr(sys, "argv", ["worker", "--once"])
    monkeypatch.setattr(worker, "once", once)
    monkeypatch.setattr(worker, "cleanup", cleanup)

    worker.main()

    once.assert_called_once_with()
    cleanup.assert_not_called()


def test_cleanup_and_queue_flags_are_mutually_exclusive(monkeypatch):
    cleanup, once = Mock(), Mock()
    monkeypatch.setattr(sys, "argv", ["worker", "--once", "--cleanup-only"])
    monkeypatch.setattr(worker, "cleanup", cleanup)
    monkeypatch.setattr(worker, "once", once)

    with pytest.raises(SystemExit) as error:
        worker.main()

    assert error.value.code == 2
    cleanup.assert_not_called()
    once.assert_not_called()


def test_default_daemon_keeps_its_idle_sleep_and_keyboard_stop(monkeypatch):
    once = Mock()
    sleep = Mock(side_effect=KeyboardInterrupt)
    monkeypatch.setattr(sys, "argv", ["worker"])
    monkeypatch.setattr(worker, "once", once)
    monkeypatch.setattr(worker.time, "sleep", sleep)

    worker.main()

    once.assert_called_once_with()
    sleep.assert_called_once_with(5)
