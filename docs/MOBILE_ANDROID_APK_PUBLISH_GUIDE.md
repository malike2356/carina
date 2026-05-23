# Mobile Android APK — build & publish guide

**Follow this checklist** whenever you ship a new Propreneur mobile build to production.

| Item | Value |
|------|--------|
| App source | `propreneur-mobile/v2/` |
| Release artifact | `propreneur-mobile/v2/dist/propreneur-mobile-release.apk` |
| Production server | `aman` — `malike@80.190.81.208` |
| MIS app root | `/www/wwwroot/propreneur-v2` |
| Public APK on disk | `public/downloads/propreneur-mobile.apk` |
| Download URL (any tenant) | `https://{workspace}.propreneur.uk/mobile/android` |
| Example (xelox) | https://xelox.propreneur.uk/mobile/android |

One APK file is shared by **all** workspaces. Help, Settings, login footer, and profile menu read `MOBILE_ANDROID_*` from the server `.env`.

---

## First-time server setup (once)

Only needed when enabling downloads on a new environment.

### 1. Deploy MIS code

Mobile download routes and Help article require `propreneur-v2` with `MobileAppDownload` support (deploy as usual):

```bash
cd /opt/lampp/htdocs/VERLOX/propreneur/propreneur-v2
./scripts/deploy-to-production.sh
```

### 2. Upload first APK

From your dev machine:

```bash
scp /opt/lampp/htdocs/VERLOX/propreneur/propreneur-mobile/v2/dist/propreneur-mobile-release.apk \
  malike@80.190.81.208:/tmp/propreneur-mobile.apk
```

On **aman**:

```bash
cd /www/wwwroot/propreneur-v2
mkdir -p public/downloads
sudo cp /tmp/propreneur-mobile.apk public/downloads/propreneur-mobile.apk
sudo chown www:www public/downloads/propreneur-mobile.apk
chmod 644 public/downloads/propreneur-mobile.apk
```

### 3. Configure `.env` on aman

Append to `/www/wwwroot/propreneur-v2/.env` (paths must be absolute):

```env
MOBILE_ANDROID_VERSION=1.0.0
MOBILE_ANDROID_APK_PATH=/www/wwwroot/propreneur-v2/public/downloads/propreneur-mobile.apk
```

Alternative: `MOBILE_ANDROID_APK_URL=https://…` redirects instead of serving the file locally.

### 4. Cache config & sync Help

```bash
cd /www/wwwroot/propreneur-v2
/www/server/php/83/bin/php artisan help:sync
/www/server/php/83/bin/php artisan config:cache
```

### 5. Verify

```bash
curl -sI https://xelox.propreneur.uk/mobile/android | head -5
```

Expect: `HTTP/2 200` and `content-type: application/vnd.android.package-archive`.

In browser: Help → **Dashboard & Navigation** → **Propreneur Mobile App**, login footer, Settings → Account → **Mobile app (Android)**.

---

## Every new app release (routine)

Use this after **any** change you want users to install from the MIS download link.

### Step 1 — Build release APK (local)

```bash
cd /opt/lampp/htdocs/VERLOX/propreneur/propreneur-mobile/v2
npm run typecheck          # recommended
npm run build:apk:release
```

Confirm output exists: `dist/propreneur-mobile-release.apk`.

If you added native modules or changed icons:

```bash
rm -rf android && npx expo prebuild --platform android --no-install
npm run build:apk:release
```

See also: `propreneur-mobile/v2/BUILD_APK.md`, `PUSH_NOTIFICATIONS.md`.

### Step 2 — Upload to server

```bash
scp dist/propreneur-mobile-release.apk malike@80.190.81.208:/tmp/propreneur-mobile.apk
```

### Step 3 — Replace live file (aman)

```bash
cd /www/wwwroot/propreneur-v2
sudo cp /tmp/propreneur-mobile.apk public/downloads/propreneur-mobile.apk
sudo chown www:www public/downloads/propreneur-mobile.apk
```

### Step 4 — Bump version label (recommended)

Edit `.env` on aman so Help/Settings show the new version:

```env
MOBILE_ANDROID_VERSION=1.0.1
```

Then:

```bash
/www/server/php/83/bin/php artisan config:cache
```

### Step 5 — Verify

```bash
curl -sI https://xelox.propreneur.uk/mobile/android | head -5
```

Install on a test device from the Help page or direct URL.

---

## What you do **not** need each release

| Action | Needed on APK-only update? |
|--------|----------------------------|
| Full `./scripts/deploy-to-production.sh` | No (unless MIS/Help code changed) |
| `php artisan help:sync` | No |
| `php artisan migrate` | No |
| Restart Horizon | No |

Run a **full deploy** only when you change `propreneur-v2` (routes, Help UI, `MobileAppDownload`, etc.).

---

## Tell users

- **Sideload does not auto-update.** They must open the download link again and install over the existing app.
- **Sign-in:** workspace slug (e.g. `xelox`) + same email/password as the website.
- **Operator plan** (or above) is required for mobile API access on most workspaces.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `404` on `/mobile/android` | Add `MOBILE_ANDROID_APK_PATH` or `MOBILE_ANDROID_APK_URL` to `.env`, then `config:cache` |
| `404` but env is set | Run `config:clear` then `config:cache`; confirm file exists and `www` can read it |
| Download links hidden in UI | `MobileAppDownload::isConfigured()` is false — check path/file |
| Wrong version in Help | Update `MOBILE_ANDROID_VERSION` and `config:cache` |
| Old content on Help page | `help:sync --force` (only if markdown under `resources/docs/help/` changed) |

---

## Related docs

- `propreneur-mobile/v2/BUILD_APK.md` — local build, adb install, push, icons
- `propreneur-mobile/v2/PUSH_NOTIFICATIONS.md` — Firebase / FCM
- `brain/knowledge/129-mobile-api.md` — API + hosting summary
- `config/mobile.php` — `MOBILE_ANDROID_*` keys
- `.env.example` — env template

---

**Last verified:** 2026-05-23 (xelox.propreneur.uk, aman `/www/wwwroot/propreneur-v2`).
