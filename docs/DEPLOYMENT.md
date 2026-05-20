# Propreneur v2 — Deployment Runbook

**Git ↔ production mirror (read this first):** [`GIT_PRODUCTION_MIRROR.md`](GIT_PRODUCTION_MIRROR.md) — keep GitHub, tsalach, and aman on the same commit; recover from either side if one is lost.

## Infrastructure map (remember this)

| Role | Hostname / SSH | What lives there | Deploy how |
|------|----------------|------------------|------------|
| **Local dev** | **`tsalach`** (your PC) | Git clones, Cursor, XAMPP optional (`/opt/lampp/htdocs/VERLOX/propreneur/…`) | `git pull`, `./scripts/deploy-to-production.sh` — **never** “production deploy” from here to itself |
| **MIS / API (v2)** | **`aman`** — `malike@80.190.81.208` | Laravel app `propreneur.uk` + `*.propreneur.uk` at `/www/wwwroot/propreneur-v2` | **Rsync from tsalach** (no `.git` on server). See [Quick deploy](#quick-deploy-code-update) |
| **Marketing** | **HostGator** — `n15dzk3l@bwehltd.com`, path `~/propreneur.co.uk` | Static site `propreneur.co.uk` (HTML, `start.html`, legal pages) | **`git pull`** on HostGator after push to GitHub — **not** rsync to aman |

**Do not mix:** Marketing deploy does **not** go to Contabo. MIS deploy does **not** use HostGator `~/propreneur.co.uk`.

**Signup API:** Marketing `start.html` calls `PROPRENEUR_API_BASE_URL` → `https://propreneur.uk` (aman).

---

### MIS production (this document)

**Server:** Contabo VPS (hostname **`aman`**) — `80.190.81.208`  
**SSH user:** `malike`  
**App path:** `/www/wwwroot/propreneur-v2`  
**Domain:** `propreneur.uk` (central) + `*.propreneur.uk` (tenant workspaces)  
**DNS / edge:** Cloudflare (proxied), registrar on Cloudflare  
**Panel:** aaPanel (Nginx 1.24, PHP 8.3 FPM, Supervisor plugin)  
**Stack:** PostgreSQL 16, Redis 7, Meilisearch, Laravel Horizon

**Security:** Production has **no `.git` directory** (removed on purpose). Deploy via **rsync from tsalach**, not `git pull` on aman.

### Marketing (separate)

Repo folder: `propreneur.co.uk/` (sibling of `propreneur-v2/` in the monorepo checkout).  
Runbook: `propreneur.co.uk/README.md` — HostGator `git pull`, not this file.

---

## Production architecture (summary)

| Layer | Role |
|-------|------|
| **Cloudflare** | DNS, TLS edge, `www` → apex redirect, DDoS/cache |
| **Nginx (aaPanel)** | Docroot `.../public`, tenant `*.propreneur.uk` vhosts |
| **PHP 8.3 FPM** | Must read full project tree (`vendor/`, `storage/`) |
| **PostgreSQL** | Central DB + per-tenant DBs (stancl/tenancy) |
| **Redis** | Sessions, cache, queues |
| **Supervisor** | `propreneur-horizon`, `propreneur-scheduler` (configs in `/etc/supervisor/conf.d/`) |
| **Horizon** | Processes Redis queues including **`security`** (alert emails) |

**Security:** Production has **no `.git` directory** (removed on purpose). Deploy via **rsync from a dev machine**, not `git pull` on the server.

---

## Quick deploy (code update)

Production has **no `.git`** (security). Deploy **from tsalach** with **git pull + rsync**:

```bash
# On tsalach (local dev) — NOT on aman
cd /opt/lampp/htdocs/VERLOX/propreneur/propreneur-v2   # or your clone path
cp scripts/deploy.env.example scripts/deploy.env   # once: DEPLOY_SSH=malike@80.190.81.208
chmod +x scripts/deploy-to-production.sh scripts/deploy-remote.sh

# Typical release (pull main, sync to aman, composer, migrate, restart Horizon)
./scripts/deploy-to-production.sh

# First time or UI/asset change: build Vite locally, then deploy
./scripts/deploy-to-production.sh --build-assets

# Preview sync only
./scripts/deploy-to-production.sh --dry-run
```

`scripts/deploy.env` is gitignored. Never rsync `.env` — production secrets stay on the server only.

### Manual deploy on server (emergency)

```bash
ssh malike@80.190.81.208
cd /www/wwwroot/propreneur-v2
# edit files or receive rsync from laptop — no git pull
/www/server/php/83/bin/php /usr/local/bin/composer.phar install --no-dev --optimize-autoloader --no-interaction
/www/server/php/83/bin/php artisan migrate --force
/www/server/php/83/bin/php artisan config:clear
sudo supervisorctl restart propreneur-horizon propreneur-scheduler
```

### Deploy script reference

| File | Purpose |
|------|---------|
| `scripts/deploy-to-production.sh` | Local: `git pull` → `rsync` → SSH remote steps → writes `storage/app/deploy-manifest.json` |
| `scripts/deploy-remote.sh` | Server: composer, migrate, cache clear, supervisor restart |
| `scripts/check-production-mirror.sh` | Compare local `HEAD` with production deploy manifest |
| `scripts/sync-from-production.sh` | Recovery: rsync code from aman → local, then commit and push to GitHub |
| `scripts/deploy.env.example` | Copy to `scripts/deploy.env` (gitignored): `DEPLOY_SSH`, paths |

Flags: `--dry-run`, `--build-assets`, `--skip-migrate`, `--optimize`, `--no-restart`. See script header comments.

### Troubleshooting deploy

| Symptom | Meaning | Action |
|---------|---------|--------|
| `rsync: failed to set times` + exit **23** | Harmless: `www` owns dirs; rsync cannot set mtimes | Safe to continue; script uses `-O` to reduce noise |
| `composer.phar: Permission denied` | Deploy user cannot execute the phar directly | Use wrapper: `DEPLOY_REMOTE_COMPOSER=/usr/local/bin/composer` in `deploy.env`, or create wrapper (see Composer section below) |
| `filament:upgrade` → `Permission denied` on `public/js/filament/...` | Rsync wrote assets as `malike`; composer runs as `www` | `sudo chown -R www:www storage bootstrap/cache public/js public/css` then re-run `deploy-remote.sh` |
| `vendor/composer/...` Permission denied | `vendor/` owned by `malike` after rsync | `sudo chown -R www:www vendor` (or full app tree) then re-run `deploy-remote.sh` |
| HTTP 500 / `PailServiceProvider` not found | Dev `bootstrap/cache/packages.php` synced to production | On aman: `rm -f bootstrap/cache/packages.php bootstrap/cache/services.php` then `php artisan package:discover`. Deploy script now excludes those files from rsync. |
| `Command "DEPLOY_REMOTE_USER=www" is not defined` | SSH env vars not exported to remote deploy script | Pull latest `deploy-to-production.sh` (inline exports in remote heredoc). |

**Carina ↔ Slack:** full integration guide and phased build plan → [`docs/CARINA_SLACK_INTEGRATION.md`](CARINA_SLACK_INTEGRATION.md).
| `git pull` → Already up-to-date but code missing on server | Changes not pushed to `main` | `git push` from tsalach, then redeploy |
| `fatal: not a git repository` on aman | **Expected** — production has no `.git` | Deploy from **tsalach** with `./scripts/deploy-to-production.sh`, not `git pull` on the server |
| `No arguments expected for "config:clear" command, got "route:clear"` | Multiple artisan commands on one line without `&&` | Run each command separately (see below) |

**Finish a failed post-deploy on aman** (after rsync succeeded):

```bash
ssh malike@80.190.81.208
cd /www/wwwroot/propreneur-v2
sudo chown -R www:www vendor storage bootstrap/cache public/js public/css
sudo -u www -H /www/server/php/83/bin/php /usr/local/bin/composer.phar install --no-dev --optimize-autoloader --no-interaction
sudo -u www -H /www/server/php/83/bin/php artisan migrate --force
sudo -u www -H /www/server/php/83/bin/php artisan config:clear
sudo -u www -H /www/server/php/83/bin/php artisan route:clear
sudo -u www -H /www/server/php/83/bin/php artisan view:clear
sudo supervisorctl restart propreneur-horizon propreneur-scheduler
```

---

## aaPanel site settings (propreneur.uk)

Configured in **Website** → **propreneur.uk** → **Directory** / **PHP**.

| Setting | Required value | Notes |
|---------|----------------|-------|
| **Site directory** | `/www/wwwroot/propreneur-v2/public` | Laravel web root only |
| **Running directory** | `/` | Default for Laravel |
| **Anti-XSS attack** | **OFF** | When ON, `open_basedir` is limited to `public/` and Laravel breaks (`vendor/`, `storage/` blocked) |
| **Write access log** | ON | Optional |

If Anti-XSS must stay on, set **open_basedir** (PHP site settings) to:

```text
/www/wwwroot/propreneur-v2/:/tmp/
```

**Not** `.../public/:/tmp/` alone.

After changes: restart **PHP 8.3** from App Store.

### Health check (CLI)

```bash
curl -sI https://propreneur.uk/admin | head -3
# Expect: HTTP/2 302 → location: https://propreneur.uk/platform/login

curl -sI -L https://propreneur.uk/admin | tail -3
# Expect: HTTP/2 200 on login page
```

Raw `open_basedir` warnings on `/admin` mean Anti-XSS or `.user.ini` still restricts PHP to `public/` only.

---

## Cloudflare (propreneur.uk)

### DNS records (typical)

| Type | Name | Content | Proxy |
|------|------|---------|--------|
| A | `@` / `propreneur.uk` | `80.190.81.208` | Proxied |
| A | `*` | `80.190.81.208` | Proxied (tenant subdomains) |
| CNAME | `www` | `propreneur.uk` | Proxied |
| A | `mail` | server IP | DNS only (email; exposes IP — optional to tidy) |
| MX / TXT | `@` | mail / SPF | DNS only |

### Redirect rule (required)

**Rules** → **Redirect Rules** → template **Redirect from WWW to root**:

- Match: `https://www.*`
- Action: 301 → `https://${1}`
- Status: Active

Without this (or equivalent nginx redirect), requests with `Host: www.propreneur.uk` hit Laravel as tenant slug **`www`** and flood logs with `TenantCouldNotBeIdentifiedOnDomainException`.

Verify:

```bash
curl -sI https://www.propreneur.uk | grep -E 'HTTP|location'
# HTTP/2 301
# location: https://propreneur.uk/
```

### SSL

- **SSL/TLS** → **Full (strict)** when origin has valid Let’s Encrypt cert  
- **Always Use HTTPS**: On

---

## Nginx (origin)

Manage in aaPanel **Website** → **Config**, or `/www/server/panel/vhost/nginx/propreneur.uk.conf`.

**Rules:**

1. Document root always `.../propreneur-v2/public`.
2. **Do not** put `*.propreneur.uk` on a blanket HTTP redirect to apex (breaks tenant URLs).
3. Prefer **separate** HTTPS server for `www` that only 301s to apex (backup if Cloudflare bypassed).
4. Tenant HTTPS needs wildcard cert (`*.propreneur.uk`) — see [Wildcard SSL](#wildcard-ssl-for-tenant-subdomains).

Reference vhost (copy-ready) — see repo history or maintain in panel; key blocks:

- HTTP: `propreneur.uk` + `www` only → `https://propreneur.uk`
- HTTPS: `www.propreneur.uk` → 301 apex
- HTTPS: `propreneur.uk` → PHP app
- HTTP: regex `*.propreneur.uk` → PHP app
- HTTPS: regex `*.propreneur.uk` → PHP app (after wildcard cert)

Access logs:

| Log | Path |
|-----|------|
| Central | `/www/wwwlogs/propreneur-v2.log` |
| Tenants (HTTP) | `/www/wwwlogs/propreneur-v2-tenant.log` |

Reload: `sudo nginx -t && sudo systemctl restart nginx` (aaPanel “Nginx restart” if `nginx -s reload` fails with PID error).

---

## Horizon and queues

**Supervisor programs** (live configs — aaPanel “Daemon list” may stay empty; use CLI):

```bash
sudo supervisorctl status
# propreneur-horizon    RUNNING
# propreneur-scheduler  RUNNING
```

Configs: `/etc/supervisor/conf.d/propreneur-horizon.conf`, `propreneur-scheduler.conf`.

**Horizon** must include the **`security`** queue (security anomaly notification emails):

```php
// config/horizon.php — defaults.supervisor-1.queue
'queue' => ['default', 'rag-processing', 'carina', 'security'],
```

After changing:

```bash
php artisan config:clear
sudo supervisorctl restart propreneur-horizon
redis-cli LLEN queues:security   # 0 when idle
```

**Other queues** used in code but not in Horizon defaults yet: `lead-intake`, `automations`, `deals` — add when those features go live in production.

**Do not** run a long-lived `queue:work` alongside Horizon for the same queues (duplicate workers).

Horizon UI (if enabled): `https://propreneur.uk/horizon` — restrict to trusted operators.

---

## Logs and forensics (on-server)

All paths under `/www/wwwroot/propreneur-v2/storage/logs/` unless noted.

| File | Contents |
|------|----------|
| `laravel-YYYY-MM-DD.log` | App errors (`LOG_LEVEL=error` in prod → mostly errors + stack traces) |
| `carina-security-YYYY-MM-DD.log` | Carina security channel (warnings+) |
| `vcal-calendar-sync.log` | Scheduled vCal sync |
| `storage/deploy.txt` | Timestamp written by `deploy-remote.sh` |

Nginx: `/www/wwwlogs/propreneur-v2.log` (and tenant variant).

**No central log SaaS** configured — logs stay on VPS. For charts: aaPanel **Website** → **Logs**, or install **GoAccess** on nginx access logs.

**Typical noise fix:** `www` redirect (Cloudflare + nginx) stops huge `Tenant could not be identified on domain www` entries in `laravel-*.log`.

```bash
grep -c 'domain www' storage/logs/laravel-$(date +%F).log
```

Recommended `.env` logging (production):

```env
LOG_CHANNEL=stack
LOG_STACK=daily
LOG_LEVEL=warning
LOG_DAILY_DAYS=30
```

---

## Laravel central domains

`config/tenancy.php` → `central_domains` must include apex hosts (not tenant slugs):

- `propreneur.uk`
- `www.propreneur.uk` (belt-and-braces if a request bypasses redirect)
- `propreneur.co.uk`, `127.0.0.1`, `localhost` as needed for local/staging

---

## First-time server setup (already done — reference only)

### 1. Prerequisites

```bash
# PostgreSQL 16 + pgvector
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
sudo apt-get update && sudo apt-get install -y postgresql-16 postgresql-client-16 postgresql-16-pgvector

# Redis
sudo apt-get install -y redis-server libpq-dev

# Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs

# PHP pdo_pgsql (aaPanel PHP 8.3)
cd /www/server/php/83/src/ext/pdo_pgsql
sudo /www/server/php/83/bin/phpize && sudo ./configure --with-php-config=/www/server/php/83/bin/php-config --with-pdo-pgsql=/usr/include/postgresql
sudo make -j2 && sudo make install
sudo /www/server/php/83/bin/pecl install redis
# Add to both php.ini and php-cli.ini:
echo "extension_dir = \"/www/server/php/83/lib/php/extensions/no-debug-non-zts-20230831\"" >> /www/server/php/83/etc/php-cli.ini
echo "extension=pdo_pgsql.so" >> /www/server/php/83/etc/php-cli.ini
echo "extension=redis.so" >> /www/server/php/83/etc/php-cli.ini
echo "extension=pdo_pgsql.so" >> /www/server/php/83/etc/php.ini  # (uncomment if commented)
service php-fpm-83 restart

# Meilisearch
sudo install -m 755 /path/to/meilisearch-linux-amd64 /usr/local/bin/meilisearch

# Composer
curl -sS "https://getcomposer.org/download/latest-stable/composer.phar" -o /usr/local/bin/composer.phar
sudo bash -c 'printf "#!/bin/bash\n/usr/bin/php83 /usr/local/bin/composer.phar \"\$@\"\n" > /usr/local/bin/composer && chmod +x /usr/local/bin/composer'
```

### 2. PostgreSQL database setup

```bash
sudo -u postgres psql -c "CREATE USER propreneur WITH PASSWORD 'propreneur_prod_2026' CREATEDB;"
sudo -u postgres createdb -O propreneur propreneur_central
sudo -u postgres psql -d propreneur_central -c "CREATE EXTENSION IF NOT EXISTS vector;"
sudo -u postgres psql -d propreneur_central -c "GRANT ALL ON SCHEMA public TO propreneur;"
# Add to /etc/postgresql/16/main/pg_hba.conf:
echo "host    all    propreneur    127.0.0.1/32    md5" >> /etc/postgresql/16/main/pg_hba.conf
pg_ctlcluster 16 main reload
```

### 3. Deploy code

```bash
sudo mkdir -p /www/wwwroot/propreneur-v2 && sudo chown malike:malike /www/wwwroot/propreneur-v2
git clone https://github.com/malike2356/propreneur-v2.git /www/wwwroot/propreneur-v2
cd /www/wwwroot/propreneur-v2
# Create .env (see .env.example — fill in all keys)
cp .env.example .env && nano .env
mkdir -p storage/app/public storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache
sudo chown -R www:www storage bootstrap/cache && chmod -R 775 storage bootstrap/cache
/usr/bin/php83 /usr/local/bin/composer.phar install --no-dev --optimize-autoloader --no-interaction
/usr/bin/php83 artisan key:generate
/usr/bin/php83 artisan package:discover
npm install && npx vite build
/usr/bin/php83 artisan migrate --force
/usr/bin/php83 artisan db:seed --class="Database\\Seeders\\Central\\FeatureFlagSeeder" --force
# Seed dev accounts (set APP_ENV=staging temporarily):
sed -i "s/APP_ENV=production/APP_ENV=staging/" .env
/usr/bin/php83 artisan app:reseed-dev-accounts
sed -i "s/APP_ENV=staging/APP_ENV=production/" .env
mkdir -p storage/framework/{cache/data,sessions,views} storage/logs bootstrap/cache
/usr/bin/php83 artisan config:clear
/usr/bin/php83 artisan config:cache && /usr/bin/php83 artisan route:cache && /usr/bin/php83 artisan view:cache
sudo chown -R www:www /www/wwwroot/propreneur-v2
```

### 4. Nginx vhost

See **[Nginx (origin)](#nginx-origin)** for current layout. Do not use a single `server_name` line that includes both `www` and the app on HTTPS without redirecting `www` first.

### 5. SSL

```bash
# Main domain (HTTP challenge)
sudo certbot certonly --webroot -w /www/wwwroot/propreneur-v2/public \
  -d propreneur.uk -d www.propreneur.uk \
  --email lordsesame@gmail.com --agree-tos --non-interactive

# Wildcard (DNS challenge — add TXT record at DNS provider)
sudo certbot certonly --manual --preferred-challenges dns \
  -d "*.propreneur.uk" -d propreneur.uk \
  --email lordsesame@gmail.com --agree-tos
```

### 6. Supervisor (queue workers)

Files in `/etc/supervisor/conf.d/`:

**propreneur-horizon.conf:**
```ini
[program:propreneur-horizon]
command=/www/server/php/83/bin/php /www/wwwroot/propreneur-v2/artisan horizon
autostart=true
autorestart=true
user=www
redirect_stderr=true
stdout_logfile=/www/wwwlogs/horizon.log
stopwaitsecs=3600
```

**propreneur-scheduler.conf:**
```ini
[program:propreneur-scheduler]
command=/www/server/php/83/bin/php /www/wwwroot/propreneur-v2/artisan schedule:work
autostart=true
autorestart=true
user=www
redirect_stderr=true
stdout_logfile=/www/wwwlogs/scheduler.log
```

```bash
sudo supervisorctl reread && sudo supervisorctl update && sudo supervisorctl status
```

### 7. Meilisearch (systemd)

```bash
sudo systemctl enable meilisearch && sudo systemctl start meilisearch
```

---

## Wildcard SSL for tenant subdomains

**Needed for:** `xelox.propreneur.uk`, `*.propreneur.uk` on HTTPS.

Run certbot DNS challenge. You will need to add a `_acme-challenge.propreneur.uk` TXT record at your DNS provider:

```bash
sudo certbot certonly --manual --preferred-challenges dns \
  -d "*.propreneur.uk" -d propreneur.uk \
  --email lordsesame@gmail.com --agree-tos
```

After obtaining cert, update nginx vhost to add SSL block for `*.propreneur.uk`.

---

## Environment variables: production checklist

| Key | Status |
|-----|--------|
| `APP_ENV=production` | Set |
| `APP_DEBUG=false` | Set |
| `APP_KEY` | Generated |
| `APP_URL=https://propreneur.uk` | Set |
| `TENANT_BASE_DOMAIN=propreneur.uk` | Set |
| `DB_*` (PostgreSQL) | Set |
| `REDIS_*` | Set |
| `MEILISEARCH_HOST` + `MEILISEARCH_KEY` | Set |
| `MAIL_MAILER` | `log` (change to Mailgun/SMTP for real email) |
| `STRIPE_*` | Empty — fill in when billing enabled |

---

## Tenant migrations

When a new tenant workspace is created via `/platform/admin/saas-tenancy/create`, stancl/tenancy automatically provisions the tenant DB. For existing tenants:

```bash
cd /www/wwwroot/propreneur-v2
/usr/bin/php83 artisan tenants:migrate --tenants={tenant-uuid}
# Or all:
/usr/bin/php83 artisan tenants:migrate
```

---

## Key URLs

| URL | Purpose |
|-----|---------|
| `https://propreneur.uk/platform/login` | Platform super-admin login |
| `https://propreneur.uk/admin` | Redirects to platform login when guest |
| `https://{slug}.propreneur.uk/login` | Tenant workspace login |
| `https://propreneur.uk/health` | Health check endpoint |
| `https://propreneur.uk/horizon` | Queue dashboard (protect in production) |
| `https://propreneur.uk/admin/security/scout` | SCOUT security console |
| aaPanel | Server panel (port/path per host install) |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|----------------|-----|
| White page, `open_basedir` in HTML | Anti-XSS ON or `open_basedir` = `public/` only | aaPanel: Anti-XSS OFF or widen to project root; restart PHP |
| `Tenant could not be identified on domain www` | `www` hits Laravel as tenant | Cloudflare WWW redirect; nginx www 301 |
| `git pull` fails on server | No `.git` on production (expected) | Deploy with `scripts/deploy-to-production.sh` |
| Security emails never send | `security` queue not in Horizon | Add to `config/horizon.php`; restart horizon |
| `queues:security` grows | Horizon down or missing queue | `supervisorctl status propreneur-horizon` |
| aaPanel Supervisor list empty | Programs in `/etc/supervisor/conf.d/` only | Use `supervisorctl status` |
| `horizon:terminate` permission denied | CLI user ≠ `www` | `sudo supervisorctl restart propreneur-horizon` |
| 25MB `laravel-*.log` in one day | Repeated `www` errors | Fix redirects; optional `LOG_LEVEL=warning` after stable |

---

## Changelog (ops notes)

- **2026-05-20:** Production hardened: removed `.git` from server; rsync deploy scripts; Cloudflare WWW redirect; aaPanel Anti-XSS disabled for Laravel; Horizon `security` queue; nginx/www log noise documented.
