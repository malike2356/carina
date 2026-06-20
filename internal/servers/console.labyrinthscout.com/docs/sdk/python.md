# Python SDK

Package: `labyrinth-scout`  
Source: `console.labyrinthscout.com/sdk/python/`

## Install

```bash
pip install labyrinth-scout
```

From source:

```bash
cd console.labyrinthscout.com/sdk/python
pip install -e .
```

## Constructor

```python
from labyrinth_scout import LabyrinthScoutClient

scout = LabyrinthScoutClient(
    url="http://localhost:4444",
    api_key=os.environ["SCOUT_API_KEY"],
    instance_id="my-agent-1",
    agent_type="custom",
    enabled=True,
)
```

## Methods

### `report(severity, event_type, description, metadata=None, session_id="sdk")`

```python
scout.report(
    "critical",
    "policy_violation",
    "Blocked shell-exec",
    metadata={"tool": "shell-exec"},
    session_id="sess-1",
)
```

### `report_tool_call(tool_name, params, result, duration_ms, session_id="sdk")`

```python
scout.report_tool_call(
    "search",
    {"q": "portsmouth hmo"},
    {"hits": 5},
    230,
    session_id="sess-1",
)
```

### `heartbeat()`

Registers instance with Scout. Call on a timer in production.

### `check_status() -> StatusResponse`

```python
status = scout.check_status()
if status["suspended"]:
    print(status["reason"])
```

Typed dict: `{"suspended": bool, "reason": str | None}`.

### `start_kill_switch_polling(on_suspend, interval_s=30.0) -> Callable[[], None]`

```python
def on_suspend(reason: str) -> None:
    logging.error("Suspended: %s", reason)
    sys.exit(1)

stop = scout.start_kill_switch_polling(on_suspend, interval_s=30)
# later: stop()
```

Runs polling in a daemon thread. Invokes `on_suspend` immediately if already suspended.

## Error handling

HTTP errors are logged at warning level; methods return `None` instead of raising so agents stay up when Scout is down.

## Tests

```bash
cd sdk/python
pytest
```

## Parity with Node

API surface matches `@verlox/labyrinth-scout` for report, heartbeat, tool calls, and kill-switch polling. Use either SDK for [custom agents](/integration/custom-agent).
