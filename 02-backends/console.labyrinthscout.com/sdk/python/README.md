# labyrinth-scout

Official Python SDK for [Labyrinth Scout](https://labyrinthscout.com).

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

All methods fail open: unreachable Scout never raises.
