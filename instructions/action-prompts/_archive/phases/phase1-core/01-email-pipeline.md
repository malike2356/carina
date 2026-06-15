# Action: Email Pipeline Verification (Standalone Carina)

## Goal
Verify and fix Carina's inbound/outbound email pipeline so it reliably receives emails via the Resend webhook, stores them, exposes them to the agent as tools, and sends mail on Carina's behalf.

## Context
- Project: `core.carinaai.uk` (the standalone, sellable Carina agent). Node.js 22 + TypeScript 5, ESM (`.js` import specifiers even for `.ts` files), pnpm.
- This is NOT the Propreneur-v2 PHP/Laravel codebase. The original spec this prompt derives from described a Laravel IMAP pipeline (`EmailIngestionService`, `app/Actions/Email/...`) - that does not exist here and should not be created. Carina's email pipeline is inbound-webhook based (Resend), not IMAP polling.
- Existing real files (read these first):
  - `src/tools/email.ts` - defines `emailSendTool` (outbound, via Resend SDK) and `emailListTool` (reads `inbound_emails` from Postgres)
  - `src/api/email-webhook.ts` - Express router mounted for Resend's inbound webhook, parses payload, inserts into `inbound_emails` with `ON CONFLICT (message_id) DO NOTHING`, emits `emailEvents`
  - `src/memory/migrations.ts` - owns the `inbound_emails` table schema (columns: `from_address`, `to_address`, `subject`, `body_text`, `body_html`, `message_id`, `read`, `received_at`)
  - `src/memory/db.ts` - exports the `pool` (pg.Pool) used by both files above
  - `src/config/index.ts` - `config.resend.apiKey` / `config.resend.from`
  - `src/index.ts` - where `emailWebhookRouter` is mounted onto the Express app (confirm the mount path, e.g. `/api/email`)
- Conventions: `declare` types via `interface`/`type`, no comments unless explaining a non-obvious WHY, Vitest for tests (see `src/tools/http.test.ts` for the pattern: `describe`/`it`/`vi.restoreAllMocks` with `LABYRINTH_ENABLED=false` stubbed), no em dashes, no emojis.

## Files to verify / fix (no new files expected unless a genuine gap is found)
- `src/tools/email.ts`
- `src/api/email-webhook.ts`
- `src/index.ts` (router mounting + raw-body handling for the webhook)
- `src/memory/migrations.ts` (schema correctness for `inbound_emails`)
- New: `src/tools/email.test.ts` (does not currently exist - create it)
- New: `src/api/email-webhook.test.ts` (does not currently exist - create it)

## Step-by-step

1. Read `src/api/email-webhook.ts` end to end. Confirm:
   - The route path is `POST /inbound` on the mounted router - find where it's mounted in `src/index.ts` and write down the full external path (e.g. `/api/email/inbound`).
   - Resend sends webhook payloads as `{ type, data: { from, to, subject, text, html, headers... } }`. Confirm `parsePayload()` correctly unwraps `body.data` and falls back to top-level fields. Test with a real Resend `email.received` sample payload shape (check Resend's docs structure if uncertain - do not guess at field names that don't match).
   - `to` may arrive as an array in Resend payloads (`data.to: string[]`). Confirm `parsePayload` handles both string and array - if it does `String(data.to ?? ...)` on an array it will produce `"a,b"` rather than failing, but check whether that's the desired behavior or whether the first recipient should be stored.
   - `message_id` may be missing on some payloads (the `ON CONFLICT (message_id) DO NOTHING` only dedupes when non-null - Postgres treats NULLs as distinct, so missing message_id means duplicate inserts are possible). Decide whether this matters for Carina's use case and document the decision if you leave it.

2. Verify webhook signature validation. Resend webhooks are signed (Svix headers: `svix-id`, `svix-timestamp`, `svix-signature`) when a webhook secret is configured.
   - Check `config` for a `resend.webhookSecret` or similar - if none exists, this is a real gap: an unauthenticated POST to `/api/email/inbound` can currently inject arbitrary rows into `inbound_emails` which Carina then reads as trusted context.
   - If missing, add signature verification using the `svix` package (check `package.json` - add it if absent) before processing the payload, gated behind `config.resend.webhookSecret` being set (warn and skip verification if not configured, matching the project's "graceful degradation when not configured" pattern used elsewhere, e.g. `src/security/honeypot-client.ts`'s `isEnabled()` check).

3. Verify `src/index.ts` mounts `emailWebhookRouter` with a raw/JSON body parser that Resend's webhook expects (Express `express.json()` is fine for Resend's JSON payloads; if you add Svix signature verification, you need the raw body string for the signature check - `express.json({ verify: (req, res, buf) => { req.rawBody = buf } })` or equivalent).

4. Read `src/tools/email.ts`:
   - `emailSendTool`: confirm `config.resend.apiKey` and `config.resend.from` are read correctly, confirm the error path (`if (error) throw new Error(error.message)`) surfaces a useful message to the agent loop.
   - `emailListTool`: confirm the two SQL branches (`unreadOnly` vs not) both select the same columns and the `LIMIT $1` parameter binding is correct. Confirm `Math.min(50, Math.max(1, ...))` correctly clamps `limit` to `[1, 50]`.
   - Check whether there is a way for the agent to mark an email as read (search for an `email-mark-read` tool or similar). If there isn't one, that's a gap worth flagging - `emailListTool` supports `unread: true` filtering but nothing seems to flip `read` to true. Note it; do not build a new tool unless the spec review confirms it's needed for Phase 1 (this prompt is verification, not feature addition).

5. Confirm both tools are registered. Search `src/tools/index.ts` for `emailSendTool` and `emailListTool` being exported/registered into the `ToolRegistry`. If either is missing from registration, that is the bug - register it following the existing pattern for other tools in that file.

6. Write `src/tools/email.test.ts` (Vitest, mirror `src/tools/http.test.ts` conventions):
   - Mock `pool.query` (from `../memory/db.js`) and the `Resend` client.
   - Test `emailSendTool.execute` throws `'RESEND_API_KEY not set in .env'` when `config.resend.apiKey` is empty.
   - Test `emailSendTool.execute` returns `{ id, message: 'Email sent.' }` on success and throws `error.message` when Resend returns an error.
   - Test `emailListTool.execute` clamps `limit` to `[1, 50]` and selects the `unread`-filtered SQL branch when `unread: true`.

7. Write `src/api/email-webhook.test.ts`:
   - Use `supertest` (check `package.json` for it; add if missing) against an Express app with just `emailWebhookRouter` mounted.
   - Test a valid Resend-shaped payload inserts a row (mock `pool.query`) and returns `{ ok: true }`.
   - Test `emailEvents.emit` is called with the parsed payload (subscribe a spy via `emailEvents.onReceived`).
   - Test malformed/missing fields don't crash - they should produce empty-string fields, not throw.
   - If you added Svix signature verification in step 2, test that an unsigned/incorrectly-signed request is rejected with 401 and a correctly-signed one passes through.

## Expected behavior
- A real inbound email to Carina's configured Resend address lands in `inbound_emails` within seconds of the webhook firing.
- `email-list` tool returns those rows to the agent, correctly filtered/limited.
- `email-send` tool sends mail through Resend and surfaces clean errors when misconfigured.
- The webhook endpoint rejects requests that aren't genuinely from Resend (once signature verification is added).

## Test
```bash
cd core.carinaai.uk
pnpm vitest run src/tools/email.test.ts src/api/email-webhook.test.ts
pnpm test    # full suite must still pass - 62+ tests
pnpm build   # tsc must compile clean
```
Manual check (requires `RESEND_API_KEY` and a configured inbound address):
```bash
curl -X POST https://carinaai.uk/api/email/inbound \
  -H 'Content-Type: application/json' \
  -d '{"type":"email.received","data":{"from":"test@example.com","to":"hello@carinaai.uk","subject":"Test","text":"Hello Carina","message_id":"test-123"}}'
# then in a Carina session: "list my recent emails" should surface it
```

## Dependencies
- `RESEND_API_KEY` and `RESEND_FROM` set in `.env`
- `inbound_emails` table exists (created by `runMigrations()` on startup - confirm via `\d inbound_emails` in the `carina_central` database)
- Resend inbound routing configured to POST to `/api/email/inbound` (check Resend dashboard, not just code)
