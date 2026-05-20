# Propreneur v2 — Deployment Runbook

**Server:** Contabo VPS — `80.190.81.208`
**Domain:** `propreneur.uk` (main) + `*.propreneur.uk` (tenant subdomains)
**Stack:** Ubuntu 24.04, Nginx 1.24 (aaPanel), PHP 8.3 FPM, PostgreSQL 16, Redis 7, Meilisearch 1.12, Supervisor

---

## Quick deploy (code update)

Production has **no `.git`** (security). Deploy from your dev machine with **git pull + rsync**:

```bash
cd propreneur-v2
cp scripts/deploy.env.example scripts/deploy.env   # once: set DEPLOY_SSH, paths
chmod +x scripts/deploy-to-production.sh scripts/deploy-remote.sh

# Typical release (pull main, sync, composer, migrate, restart Horizon)
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

File: `/www/server/panel/vhost/nginx/propreneur.uk.conf`

```nginx
# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name propreneur.uk www.propreneur.uk;
    return 301 https://propreneur.uk$request_uri;
}

# HTTPS main domain
server {
    listen 443 ssl http2;
    server_name propreneur.uk www.propreneur.uk;
    ssl_certificate     /etc/letsencrypt/live/propreneur.uk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/propreneur.uk/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    root /www/wwwroot/propreneur-v2/public;
    index index.php;
    location / { try_files $uri $uri/ /index.php?$query_string; }
    location ~ \.php$ {
        fastcgi_pass  unix:/tmp/php-cgi-83.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }
}

# Tenant subdomains (HTTP — add SSL wildcard cert when available)
server {
    listen 80;
    server_name ~^(?<subdomain>[^.]+)\.propreneur\.uk$;
    root /www/wwwroot/propreneur-v2/public;
    index index.php;
    location / { try_files $uri $uri/ /index.php?$query_string; }
    location ~ \.php$ {
        fastcgi_pass  unix:/tmp/php-cgi-83.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }
}
```

Reload: `sudo /www/server/nginx/sbin/nginx -s reload`

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
command=/usr/bin/php83 /www/wwwroot/propreneur-v2/artisan horizon
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
command=/usr/bin/php83 /www/wwwroot/propreneur-v2/artisan schedule:work
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
| `http://xelox.propreneur.uk/login` | Xelox tenant login |
| `https://propreneur.uk/health` | Health check endpoint |
| `http://80.190.81.208:11650/5d12389b` | aaPanel (server management) |
| `https://80.190.81.208:9090` | Cockpit (system monitoring) |
