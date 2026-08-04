# Google Recorder → Aiva (Path A)

**Status:** Implemented (MVP)  
**Owner surface:** Aiva worker knowledge base  
**Poll interval:** every 15 minutes (configurable)  
**Code:** `src/ingestion/google-recorder/`  
**API:** `/api/aiva/google-recorder/*`

## Purpose

When you record on Google Recorder (Pixel), Aiva should receive the recording automatically: transcript into the worker knowledge base, without a manual Share tap each time.

## What Google actually supports

| Claim | Truth |
|---|---|
| Public Recorder API | None |
| Auto backup to Google Drive | No |
| Official backup destination | [recorder.google.com](https://recorder.google.com/) when Backup & Sync is on |
| Manual save to Drive | Yes (Share / save elsewhere); not used by this Path A flow |

Path A therefore **polls recorder.google.com** with Playwright using a saved browser session (`storageState`). It is UI automation. Google UI changes can break listing or download until selectors are updated. Sessions expire; operators must re-login occasionally.

## Architecture

```text
Pixel Google Recorder
  |  Backup & Sync
  v
recorder.google.com  (audio + Google transcript)
  |  Croner every 15 min (Europe/London)
  v
core.carinaai.uk  src/ingestion/google-recorder/
  |  Playwright + encrypted storageState
  |  dedupe by recording id
  |  transcript from page, else Whisper on audio
  v
aiva_knowledge_base  (OPS_KNOWLEDGE_WRITE: stored, not persona-budgeted)
```

### Module layout

| File | Role |
|---|---|
| `recorder-config.ts` | Feature flags and cron defaults |
| `recorder-connection-store.ts` | Encrypted session + seen ids (`aiva_google_recorder_connections`) |
| `recorder-browser.ts` | Playwright list/detail/download (or fixture mode) |
| `recorder-ingest.ts` | Knowledge document write + optional Whisper |
| `recorder-poller.ts` | Croner lifecycle and per-worker poll |
| `scripts/google-recorder-login.mjs` | Interactive storageState capture |
| `api/aiva-google-recorder-api.ts` | Connect / status / force poll |

Startup: `src/index.ts` calls `startGoogleRecorderPoller()` when AI workers are enabled and the feature is active. Routes mount from `src/server.ts` when `isGoogleRecorderActive()`.

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `AIVA_GOOGLE_RECORDER_ENABLED` | `false` | Global enable |
| `AIVA_GOOGLE_RECORDER_PILOT_WORKSPACE_IDS` | empty | Comma-separated workspace UUIDs when global is false |
| `AIVA_GOOGLE_RECORDER_POLL_CRON` | `*/15 * * * *` | Croner expression (Europe/London) |
| `AIVA_GOOGLE_RECORDER_POLL_LIMIT` | `10` | Max new recordings per worker per cycle |
| `AIVA_GOOGLE_RECORDER_HEADLESS` | `true` | Playwright headless |
| `AIVA_GOOGLE_RECORDER_FIXTURE_DIR` | unset | Test/dry-run: read `listings.json` instead of live browser |
| `CHANNEL_CREDENTIAL_KEY` | required | 32-byte hex; encrypts storageState |

Also requires `AI_WORKERS_ENABLED` not set to `false`, and Whisper/OpenAI (or local Whisper) if page transcript is missing.

Example `.env` block:

```bash
AIVA_GOOGLE_RECORDER_ENABLED=true
AIVA_GOOGLE_RECORDER_POLL_CRON=*/15 * * * *
AIVA_GOOGLE_RECORDER_POLL_LIMIT=10
AIVA_GOOGLE_RECORDER_HEADLESS=true
CHANNEL_CREDENTIAL_KEY=<64-hex>
```

Restart core after changing flags so the poller and routes register.

## Operator setup (end to end)

### 1. Phone

1. Open Google Recorder on Pixel.
2. Turn **Backup & Sync** on for the Google account you will use.
3. Confirm a test recording appears at [recorder.google.com](https://recorder.google.com/) while signed in.

### 2. Capture browser session (once, then on re-auth)

On a trusted machine with a display:

```bash
cd /opt/lampp/htdocs/verlox/carina/02-backends/core.carinaai.uk
npx playwright install chromium
node scripts/google-recorder-login.mjs ./google-recorder-storage-state.json
```

Sign in to Google in the opened browser, open recorder.google.com, confirm the library loads, then press Enter in the terminal.

Treat `google-recorder-storage-state.json` as a **credential**. Do not commit it. Delete local copies after upload when possible.

### 3. Connect an Aiva worker

```bash
export CORE='https://core.carinaai.uk'   # or local core URL
export WORKSPACE_ID='...'
export WORKER_ID='...'
export TOKEN='...'                       # cloud-proxy auth as used by other /api/aiva routes

curl -sS -X POST "$CORE/api/aiva/google-recorder/connect" \
  -H "x-workspace-id: $WORKSPACE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
      --arg w "$WORKER_ID" \
      --arg ws "$WORKSPACE_ID" \
      --slurpfile s google-recorder-storage-state.json \
      '{workerId:$w, workspaceId:$ws, storageState:$s[0]}')"
```

### 4. Verify

```bash
curl -sS "$CORE/api/aiva/google-recorder/status?workerId=$WORKER_ID" \
  -H "x-workspace-id: $WORKSPACE_ID" \
  -H "Authorization: Bearer $TOKEN"

curl -sS -X POST "$CORE/api/aiva/google-recorder/poll" \
  -H "x-workspace-id: $WORKSPACE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"workerId\":\"$WORKER_ID\",\"workspaceId\":\"$WORKSPACE_ID\"}"
```

Expect `processed >= 1` for new recordings, and a knowledge document titled `Recorder: ...` on that worker.

### 5. Leave it running

The 15-minute cron ingests only **unseen** recording ids. Status `needs_reauth` means re-run the login script and `connect` again.

## API reference

All routes require cloud-proxy auth and a valid `workspaceId` (`x-workspace-id` header, or body/query). Feature must be active for that workspace.

| Method | Path | Body / query | Purpose |
|---|---|---|---|
| GET | `/api/aiva/google-recorder/status` | `workerId` | Connection status, last poll, last error, seen count |
| POST | `/api/aiva/google-recorder/connect` | `workerId`, `workspaceId`, `storageState` | Upsert encrypted session |
| POST | `/api/aiva/google-recorder/poll` | `workerId`, `workspaceId` | Force one poll now |
| POST | `/api/aiva/google-recorder/enable` | `workerId`, `enabled` | Enable or disable without deleting session |
| DELETE | `/api/aiva/google-recorder/connect/:workerId` | workspace header | Remove connection |

### Connection status values

| Status | Meaning |
|---|---|
| `connected` | Last poll OK |
| `degraded` | Poll ran but with a non-fatal error and no items |
| `needs_reauth` | Session missing or Google login redirect detected |

## Ingest behaviour

1. List recordings on recorder.google.com (skip ids already in `seen_recording_ids`).
2. For each new item, open detail URL when available.
3. Prefer on-page transcript text from Google.
4. If no transcript and audio downloads, run `transcribeAudioFile` (OpenAI Whisper, then local fallback).
5. Insert knowledge doc with `OPS_KNOWLEDGE_WRITE` (`enabled: false`, does not count toward the 50k persona budget).
6. Append recording id to seen list (capped).

Document shape (summary):

```text
# <title>
Source: Google Recorder (google-transcript|whisper|metadata-only)
Recording ID: ...
URL: ...
Ingested at: ...

## Transcript
...
```

## Security and privacy

- Encrypted at rest in DB via `CHANNEL_CREDENTIAL_KEY`.
- Do not put storageState in git, chat logs, or public tickets.
- Do not reuse this session for general agent browser tools.
- Recordings may contain sensitive speech; treat knowledge docs as confidential.
- Fixture mode (`AIVA_GOOGLE_RECORDER_FIXTURE_DIR`) is for tests only; never point it at production secrets.

## Troubleshooting

| Symptom | Action |
|---|---|
| Routes 503 | Set `AIVA_GOOGLE_RECORDER_ENABLED=true` or add workspace to pilot list; restart core |
| `CHANNEL_CREDENTIAL_KEY is not configured` | Set 64-char hex key |
| `needs_reauth` / accounts.google.com | Re-run login script and connect |
| `processed: 0` always | Confirm Backup & Sync; confirm recordings visible in browser with same account; force poll; check `lastError` |
| No transcript | Google page may not expose text; ensure Whisper/OpenAI or local Whisper works; check download button availability |
| Playwright missing | `pnpm add playwright && npx playwright install chromium` in core |

## Tests

```bash
cd /opt/lampp/htdocs/verlox/carina/02-backends/core.carinaai.uk
pnpm exec vitest run src/ingestion/google-recorder/recorder.test.ts
```

## Out of scope (this MVP)

- Real-time phone push (MacroDroid / Path B)
- Automatic Drive folder watch (Recorder does not sync there)
- Public Google Recorder API client
- App UI for connect (API + script only for now)
- Injecting recorder docs into the live persona by default

## Related docs

- Product tools / Google OAuth (Drive, etc.): `03-frontends/client-apps/app.carinaai.uk/docs/AIVA-TOOLS-SETUP.md`
- Env inventory: `docker/docs/ENV-INVENTORY.md`
