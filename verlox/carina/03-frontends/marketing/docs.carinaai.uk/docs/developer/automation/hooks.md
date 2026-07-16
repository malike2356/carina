# Automation hooks

Hooks let plugins and internal modules observe gateway events without forking core.

## Event types

Common hooks (exact set depends on version):

| Hook | Fires when |
|---|---|
| `message:in` | User message accepted by router |
| `message:out` | Assistant reply finalized |
| `tool:before` | Tool call approved, before execution |
| `tool:after` | Tool returned result |
| `session:start` | New session created |

List installed hooks:

```bash
carina hooks list
```

## Registering a hook

Via plugin manifest (see [Building plugins](/docs/developer/plugins/building-plugins)) or built-in registrations in `plugins/registry.ts`.

## Use cases

- Audit logging to external SIEM
- PII redaction on outbound messages
- Custom metrics counters
- Webhook fan-out on specific tool names

## Ordering

Hooks run in registration order unless priority is specified in manifest. Failures in one hook should not crash the gateway; check logs for hook errors.

## Source references

- `plugins/registry.ts`
- `cli/commands/hooks-cli.ts`

## Related

- [Scheduled tasks](/docs/developer/automation/scheduled-tasks)
- [Plugin overview](/docs/developer/plugins/overview)
