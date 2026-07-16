# Matrix Gateway

Carina connects to Matrix via the Matrix Client-Server API when `MATRIX_HOMESERVER_URL` and `MATRIX_ACCESS_TOKEN` are set.

## Prerequisites

- A Matrix homeserver (self-hosted Synapse, Element Homeserver, or a hosted service like `matrix.org`).
- A bot account registered on the homeserver.

## Setup

1. Register a bot user account on your homeserver. You can do this via:

   ```bash
   curl -XPOST https://your-homeserver/_matrix/client/r0/register \
     -d '{"username":"carina-bot","password":"...","kind":"user"}'
   ```

   Or use the Element web client.

2. Log in as the bot user and capture the access token:

   ```bash
   curl -XPOST https://your-homeserver/_matrix/client/r0/login \
     -d '{"type":"m.login.password","user":"carina-bot","password":"..."}'
   ```

3. Add to `.env`:

   ```
   MATRIX_HOMESERVER_URL=https://your-homeserver
   MATRIX_ACCESS_TOKEN=syt_...
   MATRIX_USER_ID=@carina-bot:your-homeserver
   ```

4. Configure your homeserver or client to send inbound messages to Carina's webhook:

   ```
   POST https://your-carina-host/webhooks/matrix
   ```

   For application service setup, use the Matrix Application Service API instead of webhooks.

5. Start Carina. Invite the bot to a room and send a message.

## Behaviour

- **Direct messages and rooms** - Responds in the room where it was mentioned or in DM rooms.
- **No streaming** - Full reply posted as a single Matrix event.
- **Thread replies** - Replies are threaded when the inbound message has a thread ID.
- **Commands** - `/help`, `/provider`, `/clear` in message content.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `MATRIX_HOMESERVER_URL` | Yes | Full URL of the Matrix homeserver |
| `MATRIX_ACCESS_TOKEN` | Yes | Bot user access token |
| `MATRIX_USER_ID` | Yes | Full Matrix user ID (e.g. `@carina:matrix.org`) |

## Troubleshooting

| Symptom | Fix |
|---|---|
| Matrix gateway not starting | Set all three environment variables |
| Bot not joining rooms | Invite the bot user to the room explicitly |
| Responses to wrong thread | Verify the inbound payload contains `m_thread` or `thread_id` |
