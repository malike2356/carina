import json
import logging
import threading
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Optional

from .types import StatusResponse

logger = logging.getLogger(__name__)
DEFAULT_TIMEOUT = 5


class LabyrinthScoutClient:
    def __init__(
        self,
        url: str,
        api_key: str,
        instance_id: str,
        agent_type: str = 'custom',
        enabled: bool = True,
    ) -> None:
        self._url = url.rstrip('/')
        self._api_key = api_key
        self._instance_id = instance_id
        self._agent_type = agent_type
        self._enabled = enabled
        self._poll_thread: Optional[threading.Thread] = None
        self._stop_polling = threading.Event()

    def report(
        self,
        severity: str,
        event_type: str,
        description: str,
        metadata: Optional[Dict[str, Any]] = None,
        session_id: str = 'sdk',
    ) -> None:
        payload_metadata = dict(metadata or {})
        payload_metadata['agent_type'] = self._agent_type
        self._post('/api/events', {
            'instance_id': self._instance_id,
            'agent_type': self._agent_type,
            'source': self._agent_type,
            'event_type': event_type,
            'severity': severity,
            'description': description,
            'session_id': session_id,
            'metadata': payload_metadata,
        })

    def report_tool_call(
        self,
        tool_name: str,
        params: Dict[str, Any],
        result: Any,
        duration_ms: int,
        session_id: str = 'sdk',
    ) -> None:
        self._post('/api/events', {
            'instance_id': self._instance_id,
            'agent_type': self._agent_type,
            'source': self._agent_type,
            'event_type': 'tool_call',
            'severity': 'info',
            'description': f'Tool executed: {tool_name}',
            'session_id': session_id,
            'metadata': {
                'toolName': tool_name,
                'params': params,
                'result': result,
                'durationMs': duration_ms,
                'agent_type': self._agent_type,
            },
        })

    def heartbeat(self) -> None:
        self._post('/api/heartbeat', {
            'instance_id': self._instance_id,
            'name': self._instance_id,
            'agent_type': self._agent_type,
            'timestamp': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        })

    def check_status(self) -> StatusResponse:
        if not self._enabled:
            return {'suspended': False, 'reason': None}
        result = self._get(f'/api/instances/{self._instance_id}/status')
        if not result:
            return {'suspended': False, 'reason': None}
        return {
            'suspended': bool(result.get('suspended', False)),
            'reason': result.get('reason'),
        }

    def start_kill_switch_polling(
        self,
        on_suspend: Callable[[str], None],
        interval_s: float = 30.0,
    ) -> Callable[[], None]:
        if not self._enabled:
            return lambda: None

        self._stop_polling.clear()
        was_suspended = [False]

        def poll_loop() -> None:
            while not self._stop_polling.wait(timeout=interval_s):
                status = self.check_status()
                if status['suspended'] and not was_suspended[0]:
                    was_suspended[0] = True
                    on_suspend(status.get('reason') or 'No reason provided')
                elif not status['suspended']:
                    was_suspended[0] = False

        try:
            status = self.check_status()
            if status['suspended']:
                was_suspended[0] = True
                on_suspend(status.get('reason') or 'No reason provided')
        except Exception:
            pass

        self._poll_thread = threading.Thread(
            target=poll_loop,
            daemon=True,
            name='labyrinth-scout-poll',
        )
        self._poll_thread.start()

        def stop() -> None:
            self._stop_polling.set()

        return stop

    def _post(self, path: str, body: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if not self._enabled:
            return None
        url = f'{self._url}{path}'
        data = json.dumps(body).encode('utf-8')
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                'Content-Type': 'application/json',
                'X-Scout-Key': self._api_key,
            },
            method='POST',
        )
        try:
            with urllib.request.urlopen(req, timeout=DEFAULT_TIMEOUT) as resp:
                raw = resp.read().decode('utf-8')
                return json.loads(raw) if raw else {}
        except Exception as exc:
            logger.warning('[LabyrinthScout] POST failed (Scout may be unreachable): %s', exc)
            return None

    def _get(self, path: str) -> Optional[Dict[str, Any]]:
        if not self._enabled:
            return None
        url = f'{self._url}{path}'
        req = urllib.request.Request(
            url,
            headers={'X-Scout-Key': self._api_key},
            method='GET',
        )
        try:
            with urllib.request.urlopen(req, timeout=DEFAULT_TIMEOUT) as resp:
                raw = resp.read().decode('utf-8')
                return json.loads(raw) if raw else {}
        except Exception as exc:
            logger.warning('[LabyrinthScout] GET failed (Scout may be unreachable): %s', exc)
            return None
