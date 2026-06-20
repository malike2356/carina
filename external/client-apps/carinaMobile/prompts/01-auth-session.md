# Carina Mobile - Prompt 01: Align auth and session with core backend

## What you are building

Finish the auth and session flow so mobile matches the current `core.carinaai.uk` backend cleanly. Chat, trust, packs, and memory must work against live Carina Cloud and self-hosted gateways.

**Working directory:** `/opt/lampp/htdocs/verlox/carina/carinaMobile`

Keep changes focused on mobile auth/session correctness. Do not refactor unrelated UI.

---

## Goal

- Session handling is stable across app restarts and new chats
- Login and onboarding do not rely on stale assumptions
- Cloud vs self-hosted auth matches the live backend contract

---

## Backend contract (verify in core)

Read these before changing mobile code:

- `core.carinaai.uk/src/gateway/hosted-chat.ts`
  - `resolveClientSessionId` reads `sessionId` from query or body
  - `resolveExternalId` maps to `hosted:{userId}:{clientSessionId}` for cloud users
- `core.carinaai.uk/src/gateway/web.ts`
  - `GET /api/chat/stream?message=&sessionId=` uses client session id for server-side continuity
  - `POST /api/chat` returns `{ reply, sessionId, agentId, provider }`
  - Streaming does not echo `sessionId` in the SSE payload
  - `POST /api/clear` resolves session via `resolveExternalId(req)`, not a raw server id

**Auth modes:**

| Mode | Credentials | Header |
|---|---|---|
| Carina Cloud | `credentials: 'include'` (cookie) | none |
| Self-hosted | `credentials: 'omit'` | `Authorization: Bearer {apiKey}` when set |

**Live endpoints:**

- `https://app.carinaai.uk`
- `https://console.labyrinthscout.com/api/public/trust`

---

## Known rough edges in mobile today

1. `src/lib/id.ts` creates `mobile-{stamp}-{rand}` only when `ensureSessionId()` runs
2. `ensureSessionId()` runs on bootstrap and first send, not when opening an empty "new chat"
3. `app/(auth)/login.tsx` hardcodes `DEFAULT_CLOUD_URL` instead of saved `instance.baseUrl`
4. `useChatSession.runCommand` never captures `sessionId` from `POST /api/chat` responses
5. `/clear` and stream must use the same client session id; confirm `client.clearSession(sessionId)` passes the id the stream uses

---

## Files to inspect and fix

```
carinaMobile/src/store/auth-store.tsx
carinaMobile/src/store/instance-store.ts
carinaMobile/src/store/api-key-store.ts
carinaMobile/src/lib/gateway-auth.ts
carinaMobile/src/lib/id.ts
carinaMobile/src/api/carina-client.ts
carinaMobile/src/api/chat-stream.ts
carinaMobile/src/hooks/useChatSession.ts
carinaMobile/src/lib/session-registry.ts
carinaMobile/src/lib/chat-session.ts
carinaMobile/app/index.tsx
carinaMobile/app/(auth)/login.tsx
carinaMobile/app/(auth)/onboarding.tsx
carinaMobile/app/instance.tsx
```

---

## Tasks

### 1. Make session creation explicit and deterministic

- On "new chat", assign a stable client session id immediately via `rotateSessionId()` before any send
- On first app open with no session id, create one at bootstrap (not mid-stream)
- Never change session id mid-conversation unless the user starts a new chat or switches sessions
- Persist session id in `instance-store`; keep local message storage keyed to the same id

### 2. Align clear/session semantics with backend

- `/clear` command and `client.clearSession(sessionId)` must pass the same client session id used in stream requests
- Verify hosted external id mapping keeps conversation memory across restarts when the same client session id is reused

### 3. Fix cloud login

- Use configured `instance.baseUrl`, not a hardcoded constant
- Login failure must not enter tabs

### 4. Separate cloud vs self-hosted flows

| Path | Flow |
|---|---|
| Cloud | onboarding -> login -> tabs (require hosted user via `/api/hosted/context`) |
| Self-hosted | onboarding -> connection test -> tabs (API key optional, no hosted login) |

`app/index.tsx` redirect logic must handle: no instance, cloud without user, self-hosted ready.

### 5. Review `app/instance.tsx`

- Switching mode or base URL should reset or warn about active sessions
- API key save/load must match `authFromInstance` behavior

### 6. Add tests (Vitest)

Create or extend tests for:

- `authFromInstance` cloud vs self-hosted headers/credentials
- `generateSessionId` format
- Session id lifecycle: bootstrap, new chat, switch, delete
- Expected cloud external id shape: `hosted:{userId}:{clientSessionId}`
- Chat stream URL builder includes `sessionId` consistently

Suggested new test files:

```
carinaMobile/src/lib/gateway-auth.test.ts
carinaMobile/src/lib/id.test.ts
carinaMobile/src/store/instance-store.test.ts   (or colocated with lib if store is thin)
```

---

## Acceptance criteria

- Session ids are stable, created before first send, and not silently rotated mid-chat
- Cloud login uses `instance.baseUrl`
- Auth headers/credentials match backend for both modes
- `/clear` and stream reuse the same client session id
- New tests pass; existing tests still pass
- `pnpm typecheck && pnpm test` pass

---

## Validation

```bash
cd /opt/lampp/htdocs/verlox/carina/carinaMobile
pnpm typecheck
pnpm test
```

Manual smoke (Expo Go or device):

1. Cloud login against `https://app.carinaai.uk`
2. Send chat message; restart app; same session messages restore
3. New chat creates distinct session in drawer
4. Self-hosted LAN gateway streams without hosted login
