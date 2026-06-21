# Configuration

Copy `.env.example` to `.env` in `console.labyrinthscout.com/`.

## Server

| Variable | Required | Default | Description |
|---|---|---|---|
| `SCOUT_PORT` | No | `4444` | HTTP listen port |
| `SCOUT_DATABASE_URL` | Yes* | - | Postgres URL (*or `DATABASE_URL`) |
| `DATABASE_URL` | Fallback | - | Used if `SCOUT_DATABASE_URL` unset |
| `REDIS_URL` | No | `redis://localhost:6379` | Events pub/sub and control channel |
| `SCOUT_API_KEY` | Yes | - | API authentication secret |
| `SCOUT_DASHBOARD_URL` | No | `http://localhost:4444` | Link in alert emails |

## Alerts (optional)

| Variable | Description |
|---|---|
| `SCOUT_TELEGRAM_BOT_TOKEN` | Telegram bot for critical alerts |
| `SCOUT_TELEGRAM_CHAT_ID` | Target chat id |
| `SCOUT_RESEND_API_KEY` | Resend API for email alerts |
| `SCOUT_ALERT_FROM_EMAIL` | From address (default `hello@carinaai.uk`) |
| `SCOUT_ALERT_TO_EMAIL` | Email recipient |
| `SCOUT_SLACK_WEBHOOK_URL` | Slack incoming webhook |
| `SCOUT_DISCORD_WEBHOOK_URL` | Discord incoming webhook |
| `SCOUT_TWILIO_ACCOUNT_SID` | Twilio account SID for SMS/WhatsApp |
| `SCOUT_TWILIO_AUTH_TOKEN` | Twilio auth token |
| `SCOUT_TWILIO_SMS_FROM` | Approved Twilio SMS sender |
| `SCOUT_TWILIO_WHATSAPP_FROM` | Approved Twilio WhatsApp sender |
| `SCOUT_ALERT_SMS_TO` | SMS alert recipient |
| `SCOUT_ALERT_WHATSAPP_TO` | WhatsApp alert recipient |

Legacy aliases `TELEGRAM_BOT_TOKEN`, `RESEND_API_KEY`, `ALERT_EMAIL_TO`, `SLACK_WEBHOOK_URL`, `DISCORD_WEBHOOK_URL`, and `TWILIO_*` still work.

## Tool policy (client-side on agents)

| Variable | Default | Description |
|---|---|---|
| `SCOUT_BLOCKLIST` | empty | Comma-separated tool names to deny |
| `SCOUT_RATE_LIMIT_MINUTE` | `15` | Max tool calls per minute per session |
| `SCOUT_RATE_LIMIT_HOUR` | `200` | Max tool calls per hour per session |

## Egress filter (client-side on agents)

| Variable | Default | Description |
|---|---|---|
| `SCOUT_ALLOWED_DOMAINS` | merged with builtins | Extra HTTPS hostnames |
| `SCOUT_BASE_URL` | - | Scout URL for reporting blocks |
| `SCOUT_INSTANCE_ID` | `unknown` | Instance id on egress events |

## OpenAI proxy mode

| Variable | Default | Description |
|---|---|---|
| `SCOUT_PROXY_ENABLED` | `false` | Enable `/v1/chat/completions` proxy |
| `SCOUT_PROXY_PORT` | `8080` | Proxy listen port |
| `SCOUT_PROXY_KEY` | - | Bearer token clients must send |
| `LABYRINTH_LLM_ROUTER_URL` | `http://localhost:3000` | Upstream OpenAI-compatible API |
| `LABYRINTH_JUDGE_MODEL` | `deepseek/deepseek-chat` | Judge model for injection layer 3 |

## Carina-side (on the agent, not Scout server)

| Variable | Description |
|---|---|
| `LABYRINTH_ENABLED` | `true` to activate integration |
| `LABYRINTH_URL` | Scout base URL |
| `LABYRINTH_API_KEY` | Must match `SCOUT_API_KEY` |
| `LABYRINTH_INSTANCE_ID` | Instance row id in Scout DB |
