# Carina Mobile - Prompt 00: Bootstrap env, docs, and build prerequisites

## What you are building

Set up the mobile project so device builds and local dev are reproducible. A new developer should be able to run the app against live Carina Cloud without guessing environment variables.

**Working directory:** `/opt/lampp/htdocs/verlox/carina/carinaMobile`

Do not touch unrelated products outside `carinaMobile/` in this prompt.

---

## Goal

- Env vars and EAS config are documented and consistent
- Docs use the correct directory name (`carinaMobile`, not `mobile/`)
- Build prerequisites are explicit before native feature work

---

## Tasks

### 1. Add `.env.example`

Include:

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_EAS_PROJECT_ID` | Expo push token project ID from `eas init` |
| `EXPO_PUBLIC_CARINA_CLOUD_URL` | Default `https://app.carinaai.uk` |
| `EXPO_PUBLIC_SCOUT_TRUST_URL` | Default `https://console.labyrinthscout.com/api/public/trust` |
| `EXPO_OWNER` | Optional Expo account owner slug |
| `GOOGLE_SERVICES_JSON` | Path to Firebase config for Android FCM (native builds) |

Do not commit real values or secrets.

### 2. Update `eas.json`

- Add `EXPO_PUBLIC_SCOUT_TRUST_URL` to `preview` and `production` env blocks (alongside existing `EXPO_PUBLIC_CARINA_CLOUD_URL`)
- Keep `REPLACE_WITH_APP_STORE_CONNECT_APP_ID` and `REPLACE_WITH_APPLE_TEAM_ID` placeholders; document them in `DEPLOY.md`

### 3. Fix doc drift

These files still say `cd mobile`; change to `cd carinaMobile`:

- `ARCHITECTURE.md`
- `CLAUDE.md`
- `DEPLOY.md`

### 4. Expand `DEPLOY.md`

Add a **Local dev** section covering:

- Expo Go limitations: no remote push, no voice input, no Android home screen widget
- When to use `development` vs `preview` vs `production` EAS profiles
- Link to `.env.example`

### 5. Align `app.config.ts` with `src/config/defaults.ts`

Ensure both read the same public env vars for cloud URL, trust URL, and EAS project id.

---

## Files to touch

```
carinaMobile/.env.example          (create)
carinaMobile/eas.json
carinaMobile/app.config.ts
carinaMobile/ARCHITECTURE.md
carinaMobile/CLAUDE.md
carinaMobile/DEPLOY.md
```

---

## Acceptance criteria

- `.env.example` exists and is accurate
- Docs use `carinaMobile` paths throughout
- `eas.json` env blocks include both cloud and trust URLs
- No secrets committed
- `pnpm typecheck && pnpm test` pass

---

## Validation

```bash
cd /opt/lampp/htdocs/verlox/carina/carinaMobile
pnpm typecheck
pnpm test
```
