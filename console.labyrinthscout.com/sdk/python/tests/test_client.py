import logging
import urllib.error
from unittest.mock import MagicMock, patch

import pytest

from labyrinth_scout import LabyrinthScoutClient


def make_client(**kwargs):
    defaults = {
        'url': 'http://localhost:4444',
        'api_key': 'test-key',
        'instance_id': 'test-instance',
    }
    defaults.update(kwargs)
    return LabyrinthScoutClient(**defaults)


def test_report_unreachable_does_not_raise(caplog):
    scout = make_client()
    with patch('urllib.request.urlopen', side_effect=urllib.error.URLError('Connection refused')):
        with caplog.at_level(logging.WARNING):
            scout.report(
                severity='info',
                event_type='test_event',
                description='hello',
            )
    assert any('POST failed' in r.message for r in caplog.records)


def test_check_status_unreachable_returns_not_suspended():
    scout = make_client()
    with patch('urllib.request.urlopen', side_effect=urllib.error.URLError('Connection refused')):
        status = scout.check_status()
    assert status == {'suspended': False, 'reason': None}


def test_all_methods_callable_without_external_dependencies():
    scout = make_client()
    mock_resp = MagicMock()
    mock_resp.read.return_value = b'{"ok": true}'
    mock_resp.__enter__ = MagicMock(return_value=mock_resp)
    mock_resp.__exit__ = MagicMock(return_value=False)

    with patch('urllib.request.urlopen', return_value=mock_resp):
        scout.report('info', 'test', 'desc')
        scout.report_tool_call('tool', {}, {}, 1)
        scout.heartbeat()
        scout.check_status()
        stop = scout.start_kill_switch_polling(lambda _r: None)
        stop()


def test_enabled_false_disables_http_calls():
    scout = make_client(enabled=False)
    with patch('urllib.request.urlopen') as urlopen_mock:
        scout.report('info', 'test', 'desc')
        scout.report_tool_call('tool', {}, {}, 1)
        scout.heartbeat()
        scout.check_status()
        scout.start_kill_switch_polling(lambda _r: None)
    urlopen_mock.assert_not_called()


def test_start_kill_switch_polling_calls_on_suspend():
    scout = make_client()
    called = []

    with patch.object(scout, 'check_status', return_value={'suspended': True, 'reason': 'test'}):
        scout.start_kill_switch_polling(lambda reason: called.append(reason))
        import time
        time.sleep(0.1)

    assert called == ['test']
