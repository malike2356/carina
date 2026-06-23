# Configuration

:::tip Canonical inventory
Provider and channel catalog sizes: [Capability inventory](/docs/capabilities).
:::

Carina reads environment variables from `~/.carina/.env` (global CLI) or a project `.env` when running from source. Copy `core.carinaai.uk/.env.example` as a template.

For provider selection, failover, and custom endpoints, see [Model providers](/docs/user/configuration/model-providers).

## Core

| Variable | Required | Default | Description |
|---|---|---|---|
| `DEFAULT_PROVIDER` | No | `deepseek` | Primary LLM: `deepseek`, `anthropic`, or `openai` |
| `DEEPSEEK_API_KEY` | If using DeepSeek | - | From [platform.deepseek.com](https://platform.deepseek.com) |
| `ANTHROPIC_API_KEY` | If using Claude | - | From [console.anthropic.com](https://console.anthropic.com) |
| `OPENAI_API_KEY` | If using GPT-4o | - | From [platform.openai.com](https://platform.openai.com) |
| `GEMINI_API_KEY` | Recommended | - | Embeddings (`text-embedding-004`, 768 dims). From [aistudio.google.com](https://aistudio.google.com) |
| `DATABASE_URL` | Yes (for memory) | `postgresql://localhost:5432/carina` | PostgreSQL with pgvector |
| `REDIS_URL` | No | `redis://localhost:6379` | Session persistence; Scout kill-switch pub/sub |
| `ACTIVE_SKILL_PACKS` | Comma-separated packs (e.g. `finance,legal-uk`). Leave empty for general-purpose mode. |
| `ACTIVE_SKILL_PACK` | Legacy alias for a single pack name |
| `SKILL_AUTO_WRITE` | No | enabled | Set to `false` to disable auto skill documents after complex tasks |
| `CARINA_AUTO_SKILL` | No | enabled | Set to `false` to disable the post-task learning loop (skill extraction and correction learning) |
| `CARINA_HOME` | No | `~/.carina` | Config and data directory |

## Tools

| Variable | Required | Default | Description |
|---|---|---|---|
| `TAVILY_API_KEY` | For web-search | - | Free tier at [tavily.com](https://tavily.com) (~1,000 credits/month) |
| `SEARCH_PROVIDER` | No | `tavily` | `tavily`, `auto`, or `brave` (Brave is paid-only) |
| `TAVILY_SEARCH_DEPTH` | No | `basic` | `basic` or `advanced` |
| `BRAVE_SEARCH_API_KEY` | Optional paid fallback | - | Paid: [brave.com/search/api](https://brave.com/search/api) |
| `RESEND_API_KEY` | For email tools | - | From [resend.com](https://resend.com) |
| `PROPERTY_DATA_API_KEY` | For property-uk pack | - | PropertyData API (prices, yields, comparables) |
| `LAND_REGISTRY_API_KEY` | For property-uk pack | - | PropertyData.co.uk key for `land-registry-search`; falls back to `PROPERTY_DATA_API_KEY` |
| `LAND_REGISTRY_BASE_URL` | No | `https://api.propertydata.co.uk` | Override PropertyData API base URL |

## Gateways

| Variable | Required | Default | Description |
|---|---|---|---|
| `WEB_ENABLED` | No | `true` | Set `false` to disable web UI |
| `WEB_PORT` | No | `3000` | Web UI and API port (`PORT` is an alias) |
| `TELEGRAM_BOT_TOKEN` | For Telegram | - | From [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_WEBHOOK_URL` | No | - | Webhook URL if not using polling |
| `TWILIO_ACCOUNT_SID` | For WhatsApp | - | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | For WhatsApp | - | Twilio auth token |
| `TWILIO_WHATSAPP_FROM` | For WhatsApp | - | Sandbox or approved WhatsApp sender |
| `SKIP_CLI` | No | - | Set `true` to skip interactive CLI (servers/containers) |
| `CORS_ORIGIN` | No | `*` | Allowed origin for web API |

## Labyrinth Scout

| Variable | Required | Default | Description |
|---|---|---|---|
| `LABYRINTH_ENABLED` | No | `false` | Enable Scout reporting and security middleware |
| `LABYRINTH_URL` | If Scout enabled | `http://localhost:4444` (self-hosted) | Scout server base URL. Hosted subscribers: use the URL from your provisioning email. |
| `LABYRINTH_API_KEY` | If Scout enabled | - | API key from provisioning email or Scout **Security** tab (Carina Cloud) |
| `LABYRINTH_INSTANCE_ID` | If Scout enabled | `carina-local` | Unique instance id ( `[a-z0-9_-]+` ) |
| `LABYRINTH_INSTANCE_NAME` | No | `Carina Local` | Display name in Scout dashboard |
| `LABYRINTH_LLM_ROUTER_URL` | No | `http://localhost:3000` | OpenAI-compatible router for prompt judge |
| `LABYRINTH_JUDGE_MODEL` | No | `deepseek/deepseek-chat` | Model id for layer-3 injection classifier |

When Scout is enabled, Carina also respects client-side policy env vars documented in Scout docs: `SCOUT_BLOCKLIST`, `SCOUT_RATE_LIMIT_MINUTE`, `SCOUT_RATE_LIMIT_HOUR`, `SCOUT_ALLOWED_DOMAINS`.

## Hosted mode (Carina Cloud)

| Variable | Required | Default | Description |
|---|---|---|---|
| `HOSTED_MODE` | No | `false` | Enable JWT auth and Stripe billing routes |
| `JWT_SECRET` | If hosted | `change-me-in-production` | Session signing secret |
| `STRIPE_SECRET_KEY` | If hosted | - | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | If hosted | - | Stripe webhook signing secret |

## Skills Hub

| Variable | Required | Default | Description |
|---|---|---|---|
| `SKILLS_HUB_URL` | No | `https://hub.carinaai.uk` | Public hub URL |
| `SKILLS_HUB_PORT` | No | `3001` | Hub server port when self-hosting |
| `SKILLS_HUB_DATABASE_URL` | No | `postgresql://localhost:5432/carina_skills_hub` | Hub Postgres database |
| `SKILLS_HUB_PUBLISH_KEY` | For publishing | - | API key for `POST /packs` |

Browse the registry with `carina hub browse`, `carina hub packs`, and `carina hub skills`. The hub web UI and JSON APIs live at `/`, `/api/registry`, `/api/packs`, and `/api/skills`.
