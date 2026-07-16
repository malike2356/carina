# iMessage / BlueBubbles Gateway

Carina connects to iMessage via the [BlueBubbles](https://bluebubbles.app) server when `BLUEBUBBLES_URL` is set.

## Prerequisites

- A Mac running macOS with Messages and iCloud sign-in.
- [BlueBubbles server](https://bluebubbles.app) installed and running on the Mac.
- A network path from your Carina host to the BlueBubbles server.

## Setup

1. Install BlueBubbles server on your Mac. Go to **Settings > Private API** and enable it.
2. Note the **Server Password** from the BlueBubbles server settings.
3. Set the BlueBubbles webhook to forward incoming messages to Carina:
   - In BlueBubbles server: **Settings > Webhooks > Add webhook**
   - URL: `https://your-carina-host/webhooks/imessage`
   - Events: new messages, message updates
4. Add to `.env`:

   ```
   BLUEBUBBLES_URL=http://mac-host:1234
   BLUEBUBBLES_PASSWORD=your-server-password
   ```

5. Start Carina. Send an iMessage to the Apple ID or phone number signed into the Mac.

## Behaviour

- **Direct messages** - iMessage conversations only; group messages are forwarded but responses go back to the chat GUID.
- **No streaming** - Full reply sent as one iMessage.
- **Attachments** - Incoming images and files are passed as paths to file tools.
- **Private API** - Some features (typing indicators, read receipts) require the BlueBubbles Private API helper.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `BLUEBUBBLES_URL` | Yes | BlueBubbles server base URL |
| `BLUEBUBBLES_PASSWORD` | Yes | BlueBubbles server password |
| `IMESSAGE_API_URL` | Alternative | Alias for `BLUEBUBBLES_URL` |
| `IMESSAGE_API_KEY` | Alternative | Alias for `BLUEBUBBLES_PASSWORD` |

## Limitations

- Requires a Mac running macOS with Messages signed in. No Linux or Windows support.
- Apple enterprise and MDM restrictions may prevent Messages API access.
- iMessage relay through BlueBubbles may break on macOS updates until BlueBubbles catches up.

## Troubleshooting

| Symptom | Fix |
|---|---|
| iMessage gateway not starting | Set `BLUEBUBBLES_URL` |
| Messages not delivered | Verify BlueBubbles server is running and webhook is configured |
| Responses appear as SMS (green bubble) | Ensure the recipient is on iMessage and the Mac is signed into iCloud |
