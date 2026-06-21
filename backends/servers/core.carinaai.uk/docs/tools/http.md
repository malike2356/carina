# HTTP Request

Makes outbound **HTTPS** requests for APIs and web fetches.

## Requirements

No API key. URL must use `https://`.

## Security

- Blocks private and link-local hosts (`localhost`, `127.0.0.1`, `10.*`, `192.168.*`, `172.16-31.*`).
- 15 second timeout; response body capped at **50 KB**.
- Methods: `GET`, `POST`, `PUT`, `DELETE`.
- With `LABYRINTH_ENABLED=true`:
  - **Egress filter** enforces domain allowlist (`SCOUT_ALLOWED_DOMAINS` plus defaults).
  - Response bodies scanned for data leaks (API key patterns, etc.).
  - Honeypot API keys in headers trigger breach events.

## Example

> "GET https://api.example.com/v1/status with header Authorization Bearer ..."

Prefer environment-based secrets; Carina should not paste live keys into chat.

## Returns

Status code, headers (selected), and body text (truncated if needed). Errors throw with a clear message when blocked by policy or SSRF rules.
