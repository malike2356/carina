# Prompt 01 - Production Chat Fix (P0)

## Objective

Make chat work end-to-end on production `app.carinaai.uk`. Users who sign in, add a BYOK key, and send a message must get a streamed assistant reply. Eliminate generic "Connection error" and opaque proxy failures.

This is P0. Nothing else in the Odysseus gap list matters until hello works.

---

## Context

**Working directory:** `/opt/lampp/htdocs/verlox/carina/app.carinaai.uk`

**Known production issues:**
- `CARINA_USE_CORE_PROXY=true` proxies to `https://core.carinaai.uk/api/chat/stream` without auth; core returns 401.
- Production DB has 0 BYOK keys for some workspaces; `streamCarinaChat` throws before streaming.
- Users may land on core HTML UI (shows "Connection error.") vs Next.js cloud UI (shows "Chat failed").

**Files to inspect first:**
- `src/lib/carina-chat.ts` (proxy branch, provider resolution)
- `src/app/api/chat/route.ts` (SSE error events)
- `src/components/chat/ChatView.tsx` (error display)
- `src/lib/keys.ts` or `getDecryptedWorkspaceKeys`
- `deploy.sh` and production `.env` on VPS

---

## Step 1 - Fix proxy strategy

In `src/lib/carina-chat.ts`, when `CARINA_USE_CORE_PROXY === 'true'`:

1. If `CARINA_INTERNAL_KEY` is set, call core with header `x-internal-key: <key>` (match what core expects; inspect `core.carinaai.uk` gateway auth middleware).
2. If internal key is missing, **do not proxy**. Fall through to direct BYOK provider streaming (`streamOpenAiCompatible`).
3. Never call an unauthenticated core stream URL.

Add env documentation in `.env.example`:

```
# Set false on cloud unless CARINA_INTERNAL_KEY is configured on both sides
CARINA_USE_CORE_PROXY=false
CARINA_INTERNAL_KEY=
```

**Production default:** `CARINA_USE_CORE_PROXY=false` until internal auth is verified.

---

## Step 2 - BYOK gate with actionable UX

Before starting SSE in `/api/chat/route.ts`:

1. Load decrypted workspace keys.
2. If empty, return SSE event immediately: `{ error: "Add at least one provider key in Settings before chatting.", code: "NO_BYOK_KEYS" }` then close stream.
3. Do not return HTTP 500.

In `ChatView.tsx`:

1. Map `NO_BYOK_KEYS` to inline assistant message with link: `/settings/keys`.
2. Map proxy failures to: "Carina could not reach the agent backend. Check Settings or try again."
3. Never show empty assistant bubble on error.

---

## Step 3 - First-run keys banner

Create `src/components/shell/KeysBanner.tsx`:

- On workspace layout, if `GET /api/keys` returns empty array, show dismissible banner at top of chat area:
  "Add an API key to start chatting." with CTA to `/settings/keys`.
- Dismiss state stored in `localStorage` key `carina_keys_banner_dismissed` (per browser only).

Wire into `(workspace)/layout.tsx`.

---

## Step 4 - Chat health endpoint

Create `GET /api/chat/health`:

```ts
// Returns { ok: boolean, hasKeys: boolean, proxyEnabled: boolean, proxyReachable?: boolean }
```

- `hasKeys`: workspace has at least one BYOK key.
- If proxy enabled and key set, optionally HEAD core stream auth endpoint (timeout 3s).

Use in settings page "Connection status" row. No secrets in response.

---

## Step 5 - Deploy checklist comment

Add `docs/PRODUCTION_CHAT.md` (short, under app root):

- Required env vars for chat
- Steps: register, add key, new chat, send message
- How to verify `/api/chat/health`

---

## Acceptance criteria

- [ ] With 0 keys: user sees clear message + link, not Connection error or blank bubble.
- [ ] With valid DeepSeek/OpenAI key and `CARINA_USE_CORE_PROXY=false`: streamed reply on production.
- [ ] With proxy + internal key on both sides: proxy path works (document in PRODUCTION_CHAT.md).
- [ ] `pnpm run build` passes.
- [ ] Manual test on VPS after `bash deploy.sh`: sign in, add key, "hello" returns text.

## Do not

- Change billing or auth flows.
- Remove `CARINA_USE_CORE_PROXY` flag; fix behavior only.
- Add new npm dependencies unless required for health check.
