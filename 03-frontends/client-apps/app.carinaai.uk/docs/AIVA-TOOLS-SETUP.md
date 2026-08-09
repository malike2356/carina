# Aiva product tools setup

Connect SaaS tools once under **Tools** (`/aiva/tools`) as **tool accounts**, or per-worker under Workers → Tools. Grants are deny-by-default at invoke. Connect runs a live probe; Connected only if the probe succeeds.

## Config (no hardcoded catalog)

| File | Override env | Purpose |
|------|----------------|---------|
| `core.carinaai.uk/config/aiva/product-tools.catalog.json` | `AIVA_PRODUCT_TOOLS_CATALOG_PATH` | 35+ tool definitions |
| `core.carinaai.uk/config/aiva/depth-features.json` | `AIVA_DEPTH_FEATURES_PATH` | Voice, skills, accounts, orgs, browser, search, projects, composer |

Reload catalog: `POST /api/aiva/tools/catalog/reload`

ARCH: `aiva-depth-ARCH.md`, `aiva-maturity-ARCH.md`, `aiva-polish-ARCH.md`

## Google OAuth (first-class accounts)

Platform default uses the **company Verlox** Google Web client (Ops `/google-oauth`). End users do not create Google Cloud projects or paste redirect URIs.

- **Account mode (preferred):** from `/aiva/tools`, Connect with Google → `mode=account` → creates Connected `aiva_tool_accounts` → grant workers.
- **Worker mode (fallback):** Workers → Tools → Connect with Google (`mode=worker`).
- Cloud callback accepts `returnPath` under `/aiva/tools` or `/aiva/workers/`.
- Redirect URI remains `/api/aiva/tools/oauth/google/callback` (via cloud proxy), already registered on the company client.
- **BYOK:** optional for orgs that paste their own Client ID/secret (Calendar settings / Guide me Advanced). Do not load customer clients into platform Ops.

## Browser / CAPTCHA

- Soft fetch: `browser` action `fetch` when `softHttpEnabled`.
- Hard navigate: Playwright when `playwrightEnabled`; CAPTCHA/challenge → `aiva_browser_assists` pause (`captchaMode=owner_assist`).
- UI: `/aiva/browser-assists` Resume / Cancel.
- `captchaMode=disabled` fails closed; `provider` uses `captchaProvider` name from config (credentials optional).

## Tool account APIs

- `GET|POST /api/aiva/tool-accounts` (optional org via `X-Aiva-Org-Id`)
- `POST .../probe`, `POST .../grant`, `DELETE .../grant/:workerId`, `DELETE .../:id`
- Browser: `GET /api/aiva/browser/assists`, `POST .../:id/resume|cancel`

## Orgs (multi-tenant shell)

- Cookie `aiva_active_org_id` + header `X-Aiva-Org-Id` on cloud proxies.
- `orgs.strictScoping` / `switcherEnabled`: workers, projects, accounts, canvas filter by active org.
- UI: sidebar switcher + `/aiva/org` membership/link card.
- Hire stamps `ai_workers.org_id` from active org header.

## Voice

See `AIVA-VOICE-SETUP.md` (`voice.duplexProvider=realtime`).

## Google Recorder → Aiva (automatic voice memos)

Path A polls [recorder.google.com](https://recorder.google.com/) every 15 minutes (not Google Drive; Recorder has no public API). Transcripts land in the worker knowledge base.

Full guide: `core.carinaai.uk/docs/aiva-google-recorder.md`

Quick path:

1. Pixel: Backup & Sync ON.
2. `AIVA_GOOGLE_RECORDER_ENABLED=true` on core; restart.
3. `node scripts/google-recorder-login.mjs` then `POST /api/aiva/google-recorder/connect`.
4. `POST /api/aiva/google-recorder/poll` to verify.

## Migrations

- `025` depth sessions/org links
- `027` tool accounts + worker org_id
- `028` browser assists + projects.org_id

## Ops

- Docker must copy `config/`.
- Playwright must be available in the carina-web image for hard navigate; otherwise error is clear.
- Google Recorder ingest also needs Playwright Chromium on core for the 15-minute poller.
