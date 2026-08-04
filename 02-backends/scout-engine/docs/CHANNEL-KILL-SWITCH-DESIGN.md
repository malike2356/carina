# Channel kill switch design

Scout emergency control uses one shared control service in the engine.

## Flow

1. A trusted operator links a daily channel to the workspace.
2. The engine stores the link in `channel_operator_links`.
3. Telegram and WhatsApp webhooks verify the sender before accepting commands.
4. Destructive actions use a confirm step and write an audit row.
5. The dashboard reads and manages the same link table through the engine API.

## Supported controls

- `STATUS`
- `PAUSE <agent_id>`
- `RESUME [agent_id]`
- `SUSPEND`
- `RESTRICT`
- `KILL`

## Rules

- Customer chats do not become control channels.
- Unknown senders are denied or ignored.
- Confirmed destructive actions are auditable and idempotent.
- WhatsApp remains behind `SCOUT_WHATSAPP_ENABLED=true`.

