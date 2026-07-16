# Web UI Gateway

The web UI is served from the same Express app as the HTTP API.

## URL and port

Default: `http://localhost:3000` (set `WEB_PORT` or `PORT`).

Open `/` for the chat UI. Static assets ship from `src/gateway/web/`.

## Features

- **SSE streaming** - Real-time tokens via `GET /api/chat/stream`.
- **Provider badge** - Shows the active LLM from `/api/providers`.
- **Session id** - Stored in `localStorage` as `carinaSessionId`; survives page refresh for the same browser profile.
- **Commands** - `/help`, `/provider [name]`, `/clear` in the input (command palette with `/`).
- **Rate limit** - 30 requests per minute per IP on `/api/chat` and stream routes.

Episodic memory persists in Postgres across refreshes. The on-screen chat log clears on refresh; use `/recall` in CLI to inspect stored turns.

For the full tools-and-features inventory, see [Capabilities](/capabilities).

## API endpoints

For custom integrations:

### `POST /api/chat`

Non-streaming JSON chat.

**Request:**

```json
{
  "message": "What is gross yield on £200k at £1100 pcm?",
  "sessionId": "my-app-user-42"
}
```

**Response:**

```json
{
  "reply": "...",
  "sessionId": "uuid-from-server"
}
```

### `GET /api/chat/stream`

Server-Sent Events stream.

**Query parameters:**

| Param | Required | Description |
|---|---|---|
| `message` | Yes | User message text |
| `sessionId` | No | External session key; server maps to internal id |

**Events:** JSON chunks with `content` deltas; final `data: [DONE]`.

### `GET /api/providers`

```json
{
  "providers": ["deepseek", "anthropic"],
  "active": "deepseek"
}
```

### `POST /api/clear`

Clears session memory for the given external session id.

```json
{ "sessionId": "my-app-user-42" }
```

## CORS

Set `CORS_ORIGIN` to your front-end origin in production. Default `*` is suitable for local development only.

## Disabling the web UI

```bash
WEB_ENABLED=false pnpm start
```

CLI and Telegram can still run if configured.
