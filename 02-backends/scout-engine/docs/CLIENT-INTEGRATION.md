# Client integration

## Emergency halt from Telegram

Trusted operators can stop Scout from Telegram once their account is linked in the dashboard.

### Operator flow

1. Open Scout Settings.
2. Link Telegram.
3. Send `/kill` in the linked chat.
4. Confirm the action when prompted.
5. The engine returns an audit code in the reply.

### What the client should expect

- Kill, freeze, and restrict require confirmation
- Resume is available from the same trusted channel
- Unknown chats cannot trigger control actions
- The same link table powers the dashboard and the channel webhooks

## WhatsApp

WhatsApp follows the same control model when `SCOUT_WHATSAPP_ENABLED=true`.
The operator sends `LINK <code>` to pair the number, then uses text commands such as `KILL`, `STATUS`, or `RESUME`.

## Verification

Run `scripts/e2e-channel-kill.sh` after local changes to confirm the link, kill, confirm, and resume path still works.
