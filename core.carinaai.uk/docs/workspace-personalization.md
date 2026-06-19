# Workspace personalization: themes, presets, gallery, and 2FA

Lightweight polish for the private web workspace: appearance that persists, saved chat presets, gallery uploads, and optional TOTP after password login.

## Custom themes

**Web:** Settings modal on `/` (chat) and theme picker in the workspace sidebar when present.

- Built-in dark/light toggle is stored in browser `localStorage`
- Custom operator themes are saved via `POST /api/theme` and persisted under `~/.carina/themes.json`
- Active custom theme name is stored in `localStorage` as `carina:active-theme`; `workspace-prefs.js` loads colors from `/api/theme` on each page

Themes survive server restarts because the API reads from disk, not memory.

**CLI:** create themes through the web UI or API. List with `GET /api/theme`.

## Workspace presets

**Web:** Settings modal, **Saved presets** section on `/`.

Save the current chat session as a named preset (session id, preview text, active provider, theme). Presets are stored in `~/.carina/workspace-presets.json`.

**API:** `GET /api/workspace/presets`, `POST /api/workspace/presets`, `DELETE /api/workspace/presets/:id` (requires web session auth).

Click a preset to switch to that session. Delete removes the preset only; the underlying chat history is unchanged.

## Session pins

In the chat sidebar, pin important sessions so they stay at the top of the session list. Pin state is stored in browser `localStorage` per device.

## Image gallery and upload

**Web:** `/images`

- Generate images when a provider is configured (same path as the agent `images` tool)
- **Upload** PNG files from disk; `POST /api/images/upload` writes into the same gallery store as generated images
- Inpaint and background removal when the configured provider supports them

Link from chat settings: **Open gallery**.

## Web login 2FA (TOTP)

Optional second step after password login on private instances.

When enabled, `POST /login` succeeds on password but sets a pending TOTP state and redirects to `/login/2fa`. Other routes stay blocked until the six-digit code is verified.

### Enable

**Environment (preferred for production):**

```bash
CARINA_WEB_TOTP_SECRET=YOUR_BASE32_SECRET
```

**File-based (local/dev):**

```bash
carina security totp enable
```

Scan the printed `otpauth://` URL or enter the base32 secret in your authenticator app.

**Status / disable:**

```bash
carina security totp status
carina security totp disable
```

If `CARINA_WEB_TOTP_SECRET` is set, file-based disable does not remove env-based TOTP.

**API:** `GET /api/auth/totp/status`, `POST /api/auth/totp/verify` (during pending sign-in only).

Requires `CARINA_WEB_PASSWORD` and `WEB_SESSION_SECRET` as for normal web login.

## Related

- [Getting started](./getting-started.md)
- [Workspace productivity](./workspace-productivity.md)
- [Web UI gateway](./gateways/web.md)
