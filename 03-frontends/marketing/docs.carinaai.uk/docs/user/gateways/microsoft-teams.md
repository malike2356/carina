# Microsoft Teams gateway

Carina can receive Teams messages through a Bot Framework registration and outbound connector.

## Prerequisites

- Azure Bot registration
- Microsoft App ID and client secret
- HTTPS endpoint for the messaging webhook

## Setup

1. Register an Azure Bot and enable the Teams channel.
2. Configure `.env`:

   ```
   TEAMS_APP_ID=your-app-id
   TEAMS_APP_PASSWORD=your-client-secret
   TEAMS_WEBHOOK_PATH=/teams/webhook
   ```

3. Set the messaging endpoint in Azure to your public URL + webhook path.
4. Install the bot in Teams and restart Carina gateway.

## Verify

@mention the bot in a channel or DM. You should receive a threaded reply.

## Message format

| Inbound | Outbound |
|---|---|
| Plain text and @mentions | Markdown subset supported by Bot Framework |
| Adaptive cards (limited) | Text and card replies when configured |

## Troubleshooting

| Symptom | Fix |
|---|---|
| 401 Unauthorized | Regenerate client secret; update `.env` |
| Bot not in tenant | Complete Teams admin approval for the app |
| Timeouts | Increase gateway worker timeout for long tool runs |

## Security

Store `TEAMS_APP_PASSWORD` in a secret manager. Rotate on schedule.

See [Gateway hardening](/docs/user/security/gateway-hardening).
