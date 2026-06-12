# Mattermost Gateway

Carina connects to Mattermost via the Mattermost REST API when `MATTERMOST_URL` and `MATTERMOST_TOKEN` are set.

## Prerequisites

- A Mattermost server (self-hosted or Mattermost Cloud).
- A bot account or personal access token with post permissions.

## Setup

1. In Mattermost, go to **Integrations > Bot Accounts** and create a bot. Copy the access token.

   Alternatively, create a Personal Access Token under **Profile > Security > Personal Access Tokens** if bot accounts are not enabled.

2. Set up an incoming webhook or outgoing webhook:
   - **Outgoing webhook**: In Mattermost, go to **Integrations > Outgoing Webhooks > Add Outgoing Webhook**.
   - Callback URL: `https://your-carina-host/webhooks/mattermost`
   - Trigger word: choose a keyword or leave blank to receive all messages in the channel.

3. Add to `.env`:

   ```
   MATTERMOST_URL=https://your-mattermost-server
   MATTERMOST_TOKEN=your-bot-or-pat-token
   ```

4. Start Carina. Post in a channel that has the outgoing webhook configured.

## Behaviour

- **Direct messages and channels** - Responds in the channel or DM that triggered the webhook.
- **No streaming** - Full reply posted as one Mattermost post.
- **Thread replies** - When triggered from a thread, replies are posted to the same thread root.
- **Commands** - `/help`, `/provider`, `/clear` in message content.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `MATTERMOST_URL` | Yes | Mattermost server base URL |
| `MATTERMOST_TOKEN` | Yes | Bot account token or personal access token |

## Troubleshooting

| Symptom | Fix |
|---|---|
| Mattermost gateway not starting | Set `MATTERMOST_URL` and `MATTERMOST_TOKEN` |
| Outgoing webhook not reaching Carina | Check that the callback URL is reachable from the Mattermost server |
| Replies posted to wrong channel | Ensure `channel_id` is present in the inbound webhook payload |
