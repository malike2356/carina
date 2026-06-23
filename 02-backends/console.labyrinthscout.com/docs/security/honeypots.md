# Honeypots

Deception layer: assets that should never be accessed in normal operation. Touching them indicates compromise or prompt-driven exfiltration.

## Types

| Type | Trigger |
|---|---|
| API key honeypots | `Authorization` header or tool param matches a decoy key |
| File path honeypots | `file-read` / `file-write` targets a monitored path |

## Management

Honeypots are stored per `instance_id`. Create via [Honeypots API](/api/honeypots):

- `POST /api/honeypots` with `type: api_key` and `keyType: openai | anthropic | deepseek`
- `POST /api/honeypots` with `type: file_path` and path pattern

List: `GET /api/honeypots?instance_id=carina-prod`.

## Agent checks

Carina calls:

- `POST /api/honeypots/check/key` before HTTP requests with keys
- `POST /api/honeypots/check/path` before file tools

On match, Scout logs **breach** severity and Carina returns access denied to the model.

## Use cases

- Plant a fake `sk-...` key in a repo; any use in the agent triggers an alert.
- Monitor `~/.ssh/id_rsa` or `secrets/production.env` paths that the agent should never read.

## Alerts

Breaches dispatch through configured Telegram, Slack, and email adapters immediately.
