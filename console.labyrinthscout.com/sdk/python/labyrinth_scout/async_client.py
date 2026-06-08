try:
    import aiohttp
except ImportError as exc:
    raise ImportError(
        'The async client requires aiohttp. Install with: pip install labyrinth-scout[async]'
    ) from exc

from datetime import datetime, timezone
from typing import Any, Callable, Dict, Optional

from .client import LabyrinthScoutClient
from .types import StatusResponse

DEFAULT_TIMEOUT = 5


class AsyncLabyrinthScoutClient(LabyrinthScoutClient):
    async def report(
        self,
        severity: str,
        event_type: str,
        description: str,
        metadata: Optional[Dict[str, Any]] = None,
        session_id: str = 'sdk',
    ) -> None:
        payload_metadata = dict(metadata or {})
        payload_metadata['agent_type'] = self._agent_type
        await self._async_post('/api/events', {
            'instance_id': self._instance_id,
            'source': self._agent_type,
            'event_type': event_type,
            'severity': severity,
            'description': description,
            'session_id': session_id,
            'metadata': payload_metadata,
        })

    async def report_tool_call(
        self,
        tool_name: str,
        params: Dict[str, Any],
        result: Any,
        duration_ms: int,
        session_id: str = 'sdk',
    ) -> None:
        await self._async_post('/api/events', {
            'instance_id': self._instance_id,
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

    async def heartbeat(self) -> None:
        await self._async_post('/api/heartbeat', {
            'instance_id': self._instance_id,
            'name': self._instance_id,
            'agent_type': self._agent_type,
            'timestamp': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        })

    async def check_status(self) -> StatusResponse:
        if not self._enabled:
            return {'suspended': False, 'reason': None}
        result = await self._async_get(f'/api/instances/{self._instance_id}/status')
        if not result:
            return {'suspended': False, 'reason': None}
        return {
            'suspended': bool(result.get('suspended', False)),
            'reason': result.get('reason'),
        }

    async def _async_post(self, path: str, body: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if not self._enabled:
            return None
        timeout = aiohttp.ClientTimeout(total=DEFAULT_TIMEOUT)
        try:
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(
                    f'{self._url}{path}',
                    json=body,
                    headers={
                        'Content-Type': 'application/json',
                        'X-Scout-Key': self._api_key,
                    },
                ) as resp:
                    return await resp.json(content_type=None)
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning(
                '[LabyrinthScout] async POST failed (Scout may be unreachable): %s',
                exc,
            )
            return None

    async def _async_get(self, path: str) -> Optional[Dict[str, Any]]:
        if not self._enabled:
            return None
        timeout = aiohttp.ClientTimeout(total=DEFAULT_TIMEOUT)
        try:
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(
                    f'{self._url}{path}',
                    headers={'X-Scout-Key': self._api_key},
                ) as resp:
                    return await resp.json(content_type=None)
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning(
                '[LabyrinthScout] async GET failed (Scout may be unreachable): %s',
                exc,
            )
            return None
