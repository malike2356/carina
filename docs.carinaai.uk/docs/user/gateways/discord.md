# Discord Gateway

Carina connects to Discord via discord.js when `DISCORD_BOT_TOKEN` is set.

## Prerequisites

- A Discord application created at [discord.com/developers/applications](https://discord.com/developers/applications).
- The bot added to a server with message permissions.

## Setup

1. Create a Discord application and navigate to the **Bot** tab.
2. Enable these Privileged Gateway Intents:
   - **Message Content Intent**
   - **Server Members Intent** (optional; needed only if Carina references member data)
3. Copy the **Token** from the Bot tab.
4. Copy the **Application ID** from the General Information tab.
5. Add to `.env`:

   ```
   DISCORD_BOT_TOKEN=...
   DISCORD_APPLICATION_ID=...
   ```

6. Invite the bot to your server using the OAuth2 URL generator with `bot` scope and these permissions:
   - Send Messages
   - Read Message History
   - Embed Links

7. Start Carina. Type in a channel where the bot has access.

## Behaviour

- **Prefix** - Carina responds when the bot is mentioned (`@YourBot message`) or in a DM.
- **No streaming** - Replies are posted once generation completes.
- **Commands** - `/help`, `/provider`, `/clear` as message content.
- **Long replies** - Discord has a 2000-character limit; Carina splits long responses into multiple messages.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DISCORD_BOT_TOKEN` | Yes | Bot token from Discord developer portal |
| `DISCORD_APPLICATION_ID` | Recommended | Used for slash command registration |

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Discord gateway skipped` at startup | Set `DISCORD_BOT_TOKEN` |
| Bot online but not responding | Enable Message Content Intent in the developer portal |
| Messages over 2000 chars truncated | Expected; Carina splits at sentence boundaries |
