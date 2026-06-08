# OpenClaw Integration

OpenClaw and other OpenAI-compatible clients can route traffic through Scout's **proxy mode** for injection scanning without modifying the agent codebase.

## Enable proxy

On the Scout server:

```bash
SCOUT_PROXY_ENABLED=true
SCOUT_PROXY_PORT=8080
SCOUT_PROXY_KEY=your_proxy_bearer_secret
LABYRINTH_LLM_ROUTER_URL=http://your-llm-upstream:3000
LABYRINTH_JUDGE_MODEL=deepseek/deepseek-chat
```

Restart Scout. A second listener starts on `SCOUT_PROXY_PORT`.

## Point OpenClaw at Scout

Set the OpenAI base URL to:

```
http://scout-host:8080/v1
```

Set the API key to `SCOUT_PROXY_KEY` (Bearer token).

## What the proxy does

| Endpoint | Behaviour |
|---|---|
| `POST /v1/chat/completions` | Scans last user message with Prompt Guard; blocks malicious requests with 403; forwards clean requests upstream; scans assistant output for tool-injection patterns |
| `POST /v1/embeddings` | Forwarded upstream (no injection scan) |
| `GET /v1/models` | Forwarded upstream |

Blocked requests are logged as Scout events with `source: openai-proxy`.

## Honeypots in headers

If a client sends a honeypot API key in `Authorization`, the proxy records a breach before forwarding.

## Limitations

Proxy mode does not report arbitrary tool calls from OpenClaw unless you also instrument the agent with the [Node SDK](/sdk/node). Use Carina or the SDK for full tool-level telemetry.
