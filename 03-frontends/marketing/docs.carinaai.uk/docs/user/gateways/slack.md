# Slack Gateway

Carina connects to Slack via the Bolt SDK using socket mode or HTTP webhooks when `SLACK_BOT_TOKEN` and `SLACK_SIGNING_SECRET` are set.

## Prerequisites

- A Slack workspace where you can install apps.
- A Slack app created at [api.slack.com/apps](https://api.slack.com/apps).

## Setup

1. Create a Slack app. Choose **Socket Mode** for development or **Event Subscriptions** for production.

2. Under **OAuth and Permissions**, add these bot token scopes:
   - `app_mentions:read`
   - `channels:history`
   - `chat:write`
   - `im:history`
   - `im:read`
   - `im:write`

3. Install the app to your workspace and copy the **Bot Token** (`xoxb-...`).

4. Under **Basic Information**, copy the **Signing Secret**.

5. For socket mode, copy the **App-Level Token** (`xapp-...`) under **Basic Information > App-Level Tokens** (with `connections:write` scope).

6. Add to `.env`:

   ```
   SLACK_BOT_TOKEN=xoxb-...
   SLACK_SIGNING_SECRET=...
   SLACK_APP_TOKEN=xapp-...
   ```

7. Start Carina (`pnpm cli` or `carina`). Mention `@YourBot` in any channel it is in.

## Behaviour

- **Direct messages** - Carina responds in DM threads.
- **Mentions** - Tag `@YourBot` in a channel to get a response.
- **Streaming** - Responses are posted as a single message once generation completes; Slack does not support live token streaming.
- **Commands** - `/help`, `/provider`, `/clear` work in messages.
- **Thread replies** - Replies stay threaded when triggered from a thread.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `SLACK_BOT_TOKEN` | Yes | Bot OAuth token (`xoxb-...`) |
| `SLACK_SIGNING_SECRET` | Yes | Request verification secret |
| `SLACK_APP_TOKEN` | Socket mode only | App-level token (`xapp-...`) |

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Slack gateway skipped` at startup | Set `SLACK_BOT_TOKEN` and `SLACK_SIGNING_SECRET` |
| Bot does not respond | Check scopes; ensure the bot is invited to the channel |
| Signature verification failed | Verify `SLACK_SIGNING_SECRET` matches the app settings |
