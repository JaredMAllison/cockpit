from datetime import datetime, timedelta
import pytest
from statemap.state import derive_state, explain_state, STATES

NOW = datetime(2026, 9, 4, 9, 0, 0)

def test_four_states_only():
    assert STATES == ("needs-you", "moving", "quiet", "degraded")

def test_degraded_wins_over_everything():
    m = {"failing": True, "overdue_tasks": 3, "last_activity": NOW}
    assert derive_state(m, NOW) == "degraded"

def test_needs_you_when_overdue_tasks():
    assert derive_state({"overdue_tasks": 1}, NOW) == "needs-you"

def test_needs_you_when_dirty_working_tree():
    assert derive_state({"dirty_files": 4}, NOW) == "needs-you"

def test_moving_when_activity_within_seven_days():
    m = {"last_activity": NOW - timedelta(days=6)}
    assert derive_state(m, NOW) == "moving"

def test_quiet_when_activity_is_older_than_seven_days():
    m = {"last_activity": NOW - timedelta(days=8)}
    assert derive_state(m, NOW) == "quiet"

def test_quiet_when_nothing_measured():
    assert derive_state({}, NOW) == "quiet"

def test_zero_overdue_is_not_needs_you():
    # A parked project is supposed to be quiet. Zero must not read as a threshold crossing.
    assert derive_state({"overdue_tasks": 0, "dirty_files": 0}, NOW) == "quiet"

def test_explain_names_the_number():
    # "If a cell is lit, 'why' answers with a number."
    assert "2" in explain_state({"overdue_tasks": 2}, NOW)

def test_explain_degraded_with_failure_reason():
    # When caller supplies failure_reason, it should be surfaced verbatim.
    m = {"failing": True, "failure_reason": "connection timeout"}
    assert explain_state(m, NOW) == "failing: connection timeout"

def test_explain_degraded_default_when_no_reason():
    # When no failure_reason is supplied, the default should indicate missing data.
    m = {"failing": True}
    result = explain_state(m, NOW)
    assert result == "failing: no reason provided"

def test_explain_overdue_precedence_over_dirty():
    # When both overdue_tasks and dirty_files are set, overdue must win.
    m = {"overdue_tasks": 3, "dirty_files": 2}
    result = explain_state(m, NOW)
    assert "3 overdue task(s)" == result

def test_explain_failing_precedence_over_overdue():
    # When both failing and overdue_tasks are set, failing must win.
    m = {"failing": True, "failure_reason": "service down", "overdue_tasks": 5}
    result = explain_state(m, NOW)
    assert result == "failing: service down"
