# Prompt 12 - SDK Packages

Build two thin SDK packages that allow any agent developer to integrate Labyrinth Scout
without implementing the HTTP protocol themselves. One package targets Node.js/TypeScript,
the other targets Python. Both are zero-dependency and fail-safe by design.

**Stack:** Node.js 22 + TypeScript 5 (SDK 1), Python 3.9+ (SDK 2). No PHP.

**Repo root:** `/opt/lampp/htdocs/VERLOX/Carina-ai/`

**SDK locations:**
- Node.js SDK: `labyrinthscout/sdk/node/`
- Python SDK: `labyrinthscout/sdk/python/`

---

## Package 1: Node.js SDK `@verlox/labyrinth-scout`

### Files to create

#### `labyrinthscout/sdk/node/package.json`

```json
{
  "name": "@verlox/labyrinth-scout",
  "version": "0.1.0",
  "description": "Official Node.js SDK for Labyrinth Scout - AI agent security control plane",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts",
    "test": "vitest run",
    "prepublishOnly": "npm run build"
  },
  "files": ["dist"],
  "keywords": ["ai", "agent", "security", "labyrinth", "scout", "verlox"],
  "license": "MIT",
  "engines": { "node": ">=18" },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.0.0",
    "vitest": "^2.0.0"
  }
}
```

Zero runtime dependencies. Uses Node built-in `fetch` (available from Node 18).

#### `labyrinthscout/sdk/node/src/types.ts`

```typescript
export type Severity = 'info' | 'warning' | 'critical' | 'breach';

export interface ReportEventOptions {
  severity: Severity;
  eventType: string;
  description: string;
  metadata?: Record<string, unknown>;
  sessionId?: string;
}

export interface ReportToolCallOptions {
  toolName: string;
  params: Record<string, unknown>;
  result: unknown;
  durationMs: number;
  sessionId?: string;
}

export interface StatusResponse {
  suspended: boolean;
  reason?: string;
}

export interface LabyrinthScoutClientOptions {
  url: string;
  apiKey: string;
  instanceId: string;
  agentType?: string;
  enabled?: boolean;
}
```

#### `labyrinthscout/sdk/node/src/client.ts`

```typescript
import type {
  LabyrinthScoutClientOptions,
  ReportEventOptions,
  ReportToolCallOptions,
  StatusResponse,
} from './types.js';

const DEFAULT_TIMEOUT_MS = 5_000;

export class LabyrinthScoutClient {
  private readonly url: string;
  private readonly apiKey: string;
  private readonly instanceId: string;
  private readonly agentType: string;
  private readonly enabled: boolean;
  private pollingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options: LabyrinthScoutClientOptions) {
    this.url = options.url.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.instanceId = options.instanceId;
    this.agentType = options.agentType ?? 'custom';
    this.enabled = options.enabled ?? true;
  }

  async report(event: ReportEventOptions): Promise<void> { ... }

  async reportToolCall(info: ReportToolCallOptions): Promise<void> { ... }

  async heartbeat(): Promise<void> { ... }

  async checkStatus(): Promise<StatusResponse> { ... }

  startKillSwitchPolling(
    onSuspend: (reason: string) => void,
    intervalMs = 30_000
  ): () => void { ... }

  private async post(path: string, body: unknown): Promise<Response | null> { ... }

  private async get(path: string): Promise<Response | null> { ... }
}
```

#### Method implementations

**`private async post(path, body)`**

```typescript
private async post(path: string, body: unknown): Promise<Response | null> {
  if (!this.enabled) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    const res = await fetch(`${this.url}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Scout-Key': this.apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res;
  } catch (err) {
    console.warn('[LabyrinthScout] POST failed (Scout may be unreachable):', (err as Error).message);
    return null;
  }
}
```

**`private async get(path)`** - same pattern but `method: 'GET'` and no `body`.

**`async report(event)`**

```typescript
async report(event: ReportEventOptions): Promise<void> {
  await this.post('/api/events', {
    instance_id: this.instanceId,
    agent_type: this.agentType,
    event_type: event.eventType,
    severity: event.severity,
    description: event.description,
    session_id: event.sessionId ?? 'sdk',
    metadata: event.metadata ?? {},
  });
}
```

**`async reportToolCall(info)`**

```typescript
async reportToolCall(info: ReportToolCallOptions): Promise<void> {
  await this.post('/api/events', {
    instance_id: this.instanceId,
    agent_type: this.agentType,
    event_type: 'tool_call',
    severity: 'info',
    description: `Tool executed: ${info.toolName}`,
    session_id: info.sessionId ?? 'sdk',
    metadata: {
      toolName: info.toolName,
      params: info.params,
      result: info.result,
      durationMs: info.durationMs,
    },
  });
}
```

**`async heartbeat()`**

```typescript
async heartbeat(): Promise<void> {
  await this.post('/api/heartbeat', {
    instance_id: this.instanceId,
    agent_type: this.agentType,
    timestamp: new Date().toISOString(),
  });
}
```

**`async checkStatus()`**

```typescript
async checkStatus(): Promise<StatusResponse> {
  if (!this.enabled) return { suspended: false };
  const res = await this.get(`/api/instances/${encodeURIComponent(this.instanceId)}/status`);
  if (!res) return { suspended: false };  // Scout unreachable: default to not suspended
  if (!res.ok) return { suspended: false };
  try {
    const data = await res.json() as { suspended: boolean; reason?: string };
    return { suspended: data.suspended, reason: data.reason };
  } catch {
    return { suspended: false };
  }
}
```

NOTE: When Scout is unreachable, `checkStatus` returns `{ suspended: false }`. This is a
deliberate fail-open design: a dead Scout should not bring down the agent. Operators who need
fail-closed behavior must implement their own watchdog.

**`startKillSwitchPolling(onSuspend, intervalMs)`**

```typescript
startKillSwitchPolling(
  onSuspend: (reason: string) => void,
  intervalMs = 30_000
): () => void {
  if (!this.enabled) return () => {};

  let wasSuspended = false;

  const poll = async () => {
    const status = await this.checkStatus();
    if (status.suspended && !wasSuspended) {
      wasSuspended = true;
      onSuspend(status.reason ?? 'No reason provided');
    } else if (!status.suspended) {
      wasSuspended = false;
    }
  };

  void poll();  // immediate first check
  this.pollingInterval = setInterval(() => void poll(), intervalMs);

  return () => {
    if (this.pollingInterval !== null) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  };
}
```

#### `labyrinthscout/sdk/node/src/index.ts`

```typescript
export { LabyrinthScoutClient } from './client.js';
export type {
  LabyrinthScoutClientOptions,
  ReportEventOptions,
  ReportToolCallOptions,
  StatusResponse,
  Severity,
} from './types.js';
```

#### `labyrinthscout/sdk/node/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "declaration": true,
    "outDir": "dist",
    "lib": ["ES2022"]
  },
  "include": ["src"]
}
```

#### `labyrinthscout/sdk/node/README.md`

Keep this file to a minimal usage example:

```typescript
import { LabyrinthScoutClient } from '@verlox/labyrinth-scout';

const scout = new LabyrinthScoutClient({
  url: process.env.LABYRINTH_URL!,
  apiKey: process.env.LABYRINTH_API_KEY!,
  instanceId: process.env.LABYRINTH_INSTANCE_ID ?? 'my-agent',
  agentType: 'custom',
});

// Suspend check before each tool call
const status = await scout.checkStatus();
if (status.suspended) throw new Error(`Agent suspended: ${status.reason}`);

// Log tool call after execution
await scout.reportToolCall({
  toolName: 'web-search',
  params: { query: 'UK base rate' },
  result: searchResults,
  durationMs: 342,
  sessionId: currentSessionId,
});

// Heartbeat every 60 seconds
setInterval(() => void scout.heartbeat(), 60_000);

// Kill switch polling (no Redis access required)
const stopPolling = scout.startKillSwitchPolling((reason) => {
  console.error(`Agent suspended by Labyrinth Scout: ${reason}`);
  process.exit(1);
});
```

---

## Package 2: Python SDK `labyrinth-scout`

### Files to create

#### `labyrinthscout/sdk/python/pyproject.toml`

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "labyrinth-scout"
version = "0.1.0"
description = "Official Python SDK for Labyrinth Scout - AI agent security control plane"
license = { text = "MIT" }
requires-python = ">=3.9"
dependencies = []

[project.optional-dependencies]
async = ["aiohttp>=3.9"]

[project.urls]
Homepage = "https://carinaai.uk"
Repository = "https://github.com/verlox/labyrinth-scout"
```

Zero required dependencies. Uses `urllib.request` from stdlib. Async extra uses `aiohttp`.

#### `labyrinthscout/sdk/python/labyrinth_scout/types.py`

```python
from typing import Any, Dict, Literal, Optional, TypedDict

Severity = Literal['info', 'warning', 'critical', 'breach']


class ReportEventOptions(TypedDict, total=False):
    severity: Severity          # required
    event_type: str             # required
    description: str            # required
    metadata: Dict[str, Any]
    session_id: str


class ReportToolCallOptions(TypedDict, total=False):
    tool_name: str              # required
    params: Dict[str, Any]      # required
    result: Any                 # required
    duration_ms: int            # required
    session_id: str


class StatusResponse(TypedDict):
    suspended: bool
    reason: Optional[str]
```

#### `labyrinthscout/sdk/python/labyrinth_scout/client.py`

```python
import json
import logging
import os
import threading
import time
import urllib.error
import urllib.request
from typing import Any, Callable, Dict, Optional

from .types import ReportEventOptions, ReportToolCallOptions, StatusResponse

logger = logging.getLogger(__name__)
DEFAULT_TIMEOUT = 5  # seconds


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

    def report(self, severity: str, event_type: str, description: str,
               metadata: Optional[Dict[str, Any]] = None,
               session_id: str = 'sdk') -> None: ...

    def report_tool_call(self, tool_name: str, params: Dict[str, Any],
                         result: Any, duration_ms: int,
                         session_id: str = 'sdk') -> None: ...

    def heartbeat(self) -> None: ...

    def check_status(self) -> StatusResponse: ...

    def start_kill_switch_polling(
        self,
        on_suspend: Callable[[str], None],
        interval_s: float = 30.0,
    ) -> Callable[[], None]: ...

    def _post(self, path: str, body: Dict[str, Any]) -> Optional[Dict[str, Any]]: ...

    def _get(self, path: str) -> Optional[Dict[str, Any]]: ...
```

#### Method implementations

**`_post(path, body)`**

```python
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
            return json.loads(resp.read().decode('utf-8'))
    except Exception as exc:
        logger.warning('[LabyrinthScout] POST failed (Scout may be unreachable): %s', exc)
        return None
```

**`_get(path)`** - same pattern without `data` and `method='GET'` (urllib default).

**`report(severity, event_type, description, metadata, session_id)`**

```python
def report(self, severity: str, event_type: str, description: str,
           metadata: Optional[Dict[str, Any]] = None,
           session_id: str = 'sdk') -> None:
    self._post('/api/events', {
        'instance_id': self._instance_id,
        'agent_type': self._agent_type,
        'event_type': event_type,
        'severity': severity,
        'description': description,
        'session_id': session_id,
        'metadata': metadata or {},
    })
```

**`report_tool_call`** - same structure as Node.js; maps to `event_type: 'tool_call'`.

**`heartbeat`** - POST to `/api/heartbeat` with `instance_id`, `agent_type`, `timestamp`
(use `datetime.utcnow().isoformat() + 'Z'`).

**`check_status`**

```python
def check_status(self) -> StatusResponse:
    if not self._enabled:
        return {'suspended': False, 'reason': None}
    result = self._get(f'/api/instances/{self._instance_id}/status')
    if not result:
        return {'suspended': False, 'reason': None}  # fail-open
    return {
        'suspended': bool(result.get('suspended', False)),
        'reason': result.get('reason'),
    }
```

**`start_kill_switch_polling(on_suspend, interval_s)`**

```python
def start_kill_switch_polling(
    self,
    on_suspend: Callable[[str], None],
    interval_s: float = 30.0,
) -> Callable[[], None]:
    if not self._enabled:
        return lambda: None

    self._stop_polling.clear()
    was_suspended = [False]  # mutable closure

    def poll_loop() -> None:
        while not self._stop_polling.wait(timeout=interval_s):
            status = self.check_status()
            if status['suspended'] and not was_suspended[0]:
                was_suspended[0] = True
                on_suspend(status.get('reason') or 'No reason provided')
            elif not status['suspended']:
                was_suspended[0] = False

    # Immediate first check before spawning thread
    try:
        status = self.check_status()
        if status['suspended']:
            was_suspended[0] = True
            on_suspend(status.get('reason') or 'No reason provided')
    except Exception:
        pass

    self._poll_thread = threading.Thread(target=poll_loop, daemon=True, name='labyrinth-scout-poll')
    self._poll_thread.start()

    def stop() -> None:
        self._stop_polling.set()

    return stop
```

#### Async extras (optional, only if `aiohttp` is installed)

Add `labyrinth_scout/async_client.py` with an `AsyncLabyrinthScoutClient` class. Same interface
as the sync client but all methods are `async def`. Use `aiohttp.ClientSession` with a
`aiohttp.ClientTimeout(total=DEFAULT_TIMEOUT)`. Guard the import at the top of the file:

```python
try:
    import aiohttp
except ImportError as exc:
    raise ImportError(
        "The async client requires aiohttp. Install with: pip install labyrinth-scout[async]"
    ) from exc
```

#### `labyrinthscout/sdk/python/labyrinth_scout/__init__.py`

```python
from .client import LabyrinthScoutClient
from .types import ReportEventOptions, ReportToolCallOptions, StatusResponse, Severity

__all__ = [
    'LabyrinthScoutClient',
    'ReportEventOptions',
    'ReportToolCallOptions',
    'StatusResponse',
    'Severity',
]
```

Do NOT import `AsyncLabyrinthScoutClient` here - it would fail for users who do not have
`aiohttp` installed.

#### `labyrinthscout/sdk/python/README.md`

Include usage:

```python
from labyrinth_scout import LabyrinthScoutClient

scout = LabyrinthScoutClient(
    url='http://localhost:4444',
    api_key='your_scout_key',
    instance_id='my-python-agent',
)

status = scout.check_status()
if status['suspended']:
    raise RuntimeError(f"Agent suspended: {status['reason']}")

scout.report(severity='critical', event_type='injection_blocked', description='Blocked prompt injection attempt')
scout.report_tool_call(tool_name='web_search', params={'query': 'UK base rate'}, result={}, duration_ms=200)
scout.heartbeat()

stop = scout.start_kill_switch_polling(lambda reason: exit(1))
```

---

## Publishing setup

### GitHub Actions - npm publish

Create `labyrinthscout/sdk/node/.github/workflows/publish-npm.yml`:

```yaml
name: Publish npm package
on:
  push:
    tags:
      - 'sdk-node-v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write  # for npm provenance
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: 'https://registry.npmjs.org'
      - run: npm install
        working-directory: labyrinthscout/sdk/node
      - run: npm run build
        working-directory: labyrinthscout/sdk/node
      - run: npm publish --access public --provenance
        working-directory: labyrinthscout/sdk/node
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### GitHub Actions - PyPI publish

Create `labyrinthscout/sdk/python/.github/workflows/publish-pypi.yml`:

```yaml
name: Publish PyPI package
on:
  push:
    tags:
      - 'sdk-python-v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      id-token: write  # for trusted publishing (no API token needed)
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install build
      - run: python -m build
        working-directory: labyrinthscout/sdk/python
      - uses: pypa/gh-action-pypi-publish@release/v1
        with:
          packages-dir: labyrinthscout/sdk/python/dist/
```

Use PyPI Trusted Publishing (OIDC) rather than an API token - it is the current best practice
and requires no secrets to be stored in GitHub. Set it up in pypi.org under the project settings.

---

## Test cases

#### Node.js tests - `labyrinthscout/sdk/node/src/__tests__/client.test.ts`

Use Vitest. Stub `fetch` with `vi.stubGlobal('fetch', vi.fn())`.

**Test 1 - report() with Scout unreachable does not throw:**
Stub `fetch` to reject with `new Error('ECONNREFUSED')`. Call `await scout.report(...)`.
Assert no exception thrown. Assert `console.warn` called.

**Test 2 - checkStatus() returns suspended=true when API says so:**
Stub `fetch` to resolve with `Response` body `{ suspended: true, reason: 'policy breach' }`.
Call `await scout.checkStatus()`. Assert returns `{ suspended: true, reason: 'policy breach' }`.

**Test 3 - checkStatus() returns suspended=false when Scout is unreachable (fail-open):**
Stub `fetch` to reject. Call `await scout.checkStatus()`. Assert returns `{ suspended: false }`.

**Test 4 - startKillSwitchPolling() calls onSuspend after status changes:**
Use fake timers (`vi.useFakeTimers()`). Stub `fetch` to return `{ suspended: false }` initially
then `{ suspended: true, reason: 'test' }` on second call. Create `onSuspend = vi.fn()`.
Call `startKillSwitchPolling(onSuspend, 1000)`. Advance timer by 1001ms. Assert `onSuspend`
called once with `'test'`.

**Test 5 - enabled=false disables all HTTP calls:**
Construct client with `enabled: false`. Call `report`, `reportToolCall`, `heartbeat`,
`checkStatus`, `startKillSwitchPolling`. Assert `fetch` never called.

#### Python tests - `labyrinthscout/sdk/python/tests/test_client.py`

Use `pytest`. Mock `urllib.request.urlopen` with `unittest.mock.patch`.

**Test 1 - report() with Scout unreachable does not raise:**
Patch `urlopen` to raise `urllib.error.URLError('Connection refused')`. Call `scout.report(...)`.
Assert no exception. Assert a warning was logged.

**Test 2 - check_status() returns not suspended when Scout is unreachable:**
Patch `urlopen` to raise. Assert returns `{ 'suspended': False, 'reason': None }`.

**Test 3 - all methods callable without external dependencies:**
Import `LabyrinthScoutClient` from `labyrinth_scout`. Assert import succeeds. Instantiate.
Call all methods with `urlopen` patched. Assert no `ImportError`.

**Test 4 - enabled=False disables HTTP calls:**
Construct with `enabled=False`. Call all methods. Assert `urlopen` never called.

**Test 5 - start_kill_switch_polling calls on_suspend on status change:**
Patch `check_status` to return `{'suspended': True, 'reason': 'test'}`. Create callback.
Call `start_kill_switch_polling`. Wait up to 1 second. Assert callback called with `'test'`.

---

## Acceptance criteria

- Node.js: `npm run build` in `labyrinthscout/sdk/node/` produces `dist/index.js`,
  `dist/index.mjs`, `dist/index.d.ts`.
- Python: `python -m build` in `labyrinthscout/sdk/python/` produces a wheel and sdist.
- Both SDKs: all methods return silently when Scout is unreachable (never throw/raise).
- Both SDKs: `enabled=false` (or env `LABYRINTH_ENABLED=false`) makes zero HTTP calls.
- `checkStatus()` / `check_status()` return `suspended: false` when Scout is unreachable
  (fail-open, not fail-closed).
- `startKillSwitchPolling()` / `start_kill_switch_polling()` call the callback exactly once
  when the suspended state transitions from false to true.
- Async Python client raises a clear `ImportError` if `aiohttp` is not installed.
- TypeScript strict mode in Node.js SDK: zero `any` types.
- Python: no third-party imports at module level (only stdlib in `__init__.py` and `client.py`).
