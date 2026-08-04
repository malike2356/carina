# Scout operator runbook

This page is the UI-only path for trusted operator control. Use it when you need to link a channel, trigger a halt, or revoke access from the console.

## Telegram

1. Open the Scout console.
2. In the left sidebar, click `Settings`.
3. Scroll to `Trusted operator channels`.
4. Click `Link Telegram`.
5. Copy the code shown in the `channelsStatus` message area.
6. Open Telegram.
7. Open the Scout bot chat.
8. Send `/start <code>`.
9. Wait for the link confirmation message.
10. After linking, return to Telegram and use:
   - `/status`
   - `/kill`
   - `/resume`
   - `/pause <agent_id>`
   - `/freeze`
   - `/restrict`

Notes:

- `kill`, `freeze`, and `restrict` require confirmation.
- The bot replies with the audit code after the action completes.
- If the chat is not linked, the bot will tell you to open `Settings -> Channels`.

## WhatsApp

1. Open the Scout console.
2. In the left sidebar, click `Settings`.
3. Scroll to `Trusted operator channels`.
4. Click `Link WhatsApp`.
5. Copy the code shown in the `channelsStatus` message area.
6. Open WhatsApp.
7. Send `LINK <code>` to the trusted business number.
8. Wait for the link confirmation message.
9. After linking, use:
   - `STATUS`
   - `KILL`
   - `RESUME`
   - `PAUSE <agent_id>`
   - `FREEZE`
   - `RESTRICT`

Notes:

- `KILL`, `FREEZE`, and `RESTRICT` require confirmation.
- Reply `CONFIRM` when the bot asks for it.
- If the number is not linked, the bot will tell you to open `Settings -> Channels`.

## Web dashboard

Linking flow:

1. Open the Scout console.
2. Click `Settings` in the left sidebar.
3. In `Trusted operator channels`, click one of:
   - `Link Telegram`
   - `Link WhatsApp`
   - `Link Slack`
4. Review the generated code in the status line.

Control flow:

1. Open the left sidebar.
2. Click `Kill Switch`.
3. Click `HALT ALL AGENTS`.
4. Confirm the modal.
5. To resume, click `Disarm`.

Channel management flow:

1. Open `Settings`.
2. In `Trusted operator channels`, review the linked rows.
3. Click `Revoke` to remove a linked operator channel.
4. Use the `Panic mode` toggle only if you want kill actions to execute immediately from a trusted channel.

## What not to expect

- Customer chats do not become trusted control channels.
- Unknown Telegram or WhatsApp chats cannot trigger controls.
- The dashboard and the channel webhooks share the same control path, but the channel app still needs the initial link step.

