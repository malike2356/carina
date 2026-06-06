# The Overall Flow

Good timing to nail this before Sprint 1\. Let me walk through the full setup end to end.

---

feature/DEAL-02-deal-detail  (local)  
        ↓ PR merge  
    staging branch           → GitHub Actions → v2.propreneur.co.uk (VPS)  
        ↓ PR merge  
    main branch              → GitHub Actions → propreneur.co.uk (VPS, later)  
        ↓  
    diff check               → migration safety, config sync, smoke test  
---

## **1\. Local Dev Environment**

You're on Linux (Ubuntu, `tsalach`). No Docker needed - native is faster and simpler for a solo developer.

### **Install order**

bash  
\# PHP 8.3  
sudo add-apt-repository ppa:ondrej/php  
sudo apt install php8.3 php8.3-fpm php8.3-cli php8.3-pgsql php8.3-redis \\  
  php8.3-mbstring php8.3-xml php8.3-curl php8.3-zip php8.3-bcmath \\  
  php8.3-intl php8.3-gd php8.3-tokenizer

\# Composer  
curl \-sS https://getcomposer.org/installer | php  
sudo mv composer.phar /usr/local/bin/composer

\# Node (via nvm \- don't use apt node, it's outdated)  
curl \-o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash  
nvm install 20  
nvm use 20

\# PostgreSQL 16  
sudo apt install \-y postgresql-16 postgresql-client-16

\# Redis  
sudo apt install \-y redis-server  
sudo systemctl enable redis-server

\# Meilisearch  
curl \-L https://install.meilisearch.com | sh  
\# Move to /usr/local/bin/meilisearch  
\# Run: meilisearch \--master-key="your\_local\_master\_key" &

\# Laravel CLI  
composer global require laravel/installer

### **Local PostgreSQL setup**

bash  
sudo \-u postgres psql

CREATE USER propreneur WITH PASSWORD 'local\_dev\_password';  
CREATE DATABASE propreneur\_central OWNER propreneur;  
GRANT ALL PRIVILEGES ON DATABASE propreneur\_central TO propreneur;  
\\q

stancl/tenancy creates tenant databases automatically when a tenant is created - you don't pre-create them. The central DB is the only one you manually create.

### **Local `.env`**

env  
APP\_NAME=Propreneur  
APP\_ENV=local  
APP\_URL=http://propreneur.test

DB\_CONNECTION=pgsql  
DB\_HOST=127.0.0.1  
DB\_PORT=5432  
DB\_DATABASE=propreneur\_central  
DB\_USERNAME=propreneur  
DB\_PASSWORD=local\_dev\_password

TENANCY\_DB\_HOST=127.0.0.1  
TENANCY\_DB\_USERNAME=propreneur  
TENANCY\_DB\_PASSWORD=local\_dev\_password  
\# stancl/tenancy uses this to create new tenant databases

CACHE\_DRIVER=redis  
SESSION\_DRIVER=redis  
QUEUE\_CONNECTION=redis  
REDIS\_HOST=127.0.0.1  
REDIS\_PORT=6379

MEILISEARCH\_HOST=http://127.0.0.1:7700  
MEILISEARCH\_KEY=your\_local\_master\_key

SCOUT\_DRIVER=meilisearch

\# API keys \- local can use test/sandbox keys  
ANTHROPIC\_API\_KEY=sk-ant-...  
PROPERTYDATA\_API\_KEY=...  
STRIPE\_KEY=pk\_test\_...  
STRIPE\_SECRET=sk\_test\_...

### **Local domain (no Apache/Nginx needed for dev)**

Use Laravel's built-in server with a hosts entry:

bash  
\# /etc/hosts  
127.0.0.1  propreneur.test  
127.0.0.1  tenant1.propreneur.test  
127.0.0.1  tenant2.propreneur.test

Then run:

bash  
php artisan serve \--host=propreneur.test \--port=80

Or use **Laravel Herd for Linux** (Herd officially supports Linux as of 2024\) - it handles Nginx \+ PHP-FPM \+ local domains automatically and is much cleaner. Worth checking if it supports your Ubuntu version.

### **Multi-tenancy local consideration**

stancl/tenancy resolves tenants by subdomain. Locally you'll need wildcard subdomain support. Add to `/etc/hosts`:

127.0.0.1  propreneur.test  
127.0.0.1  acme.propreneur.test  
127.0.0.1  testco.propreneur.test

Add new lines as you create test tenants. On the VPS you'll use a wildcard DNS record instead.

### **Local process management**

Create a `Procfile` in the project root for running everything at once:

web: php artisan serve \--host=propreneur.test \--port=8000  
queue: php artisan horizon  
schedule: php artisan schedule:work

Use `honcho` (Python) or `foreman` to run it: `honcho start`

---

## **2\. GitHub Repository Structure**

### **One repo - three branches with protection rules**

main          → production (propreneur.co.uk - later)  
staging       → v2.propreneur.co.uk (always deployable)  
feature/\*     → local only, short-lived

**Branch protection on `main`:**

* Require PR from `staging` only  
* Require all status checks to pass  
* No direct pushes - ever

**Branch protection on `staging`:**

* Require PR from `feature/*`  
* Require status checks (tests) to pass  
* Allow Laud to merge without review (solo dev)

### **Repository secrets (Settings → Secrets → Actions)**

\# Staging VPS  
STAGING\_HOST=v2.propreneur.co.uk  
STAGING\_USER=deploy  
STAGING\_SSH\_KEY=\<private key for staging deploy user\>  
STAGING\_PATH=/var/www/propreneur-v2

\# Production VPS (add later)  
PROD\_HOST=propreneur.co.uk  
PROD\_USER=deploy  
PROD\_SSH\_KEY=\<private key for prod deploy user\>  
PROD\_PATH=/var/www/propreneur-v1  \# v1 currently, swap at go-live

\# Shared  
APP\_KEY\_STAGING=base64:...  
APP\_KEY\_PROD=base64:...

Never put API keys in GitHub Secrets - those live in `.env` files on the VPS, not injected by CI. GitHub Secrets are for deployment credentials only.

### **`.gitignore` additions**

.env  
.env.staging  
.env.production  
/storage/app/  
/storage/logs/  
/bootstrap/cache/  
node\_modules/  
vendor/  
\*.docx  \# keep spec docs out of repo - they're in Google Drive  
---

## **3\. GitHub Actions CI/CD**

### **Directory structure**

.github/  
  workflows/  
    test.yml          \# runs on every PR - tests only  
    deploy-staging.yml   \# runs on merge to staging  
    deploy-prod.yml      \# runs on merge to main

### **`test.yml` - runs on every PR**

yaml  
name: Tests

on:  
  pull\_request:  
    branches: \[staging, main\]

jobs:  
  test:  
    runs-on: ubuntu-latest  
      
    services:  
      postgres:  
        image: postgres:16  
        env:  
          POSTGRES\_DB: propreneur\_central\_test  
          POSTGRES\_USER: propreneur  
          POSTGRES\_PASSWORD: test\_password  
        ports: \['5432:5432'\]  
        options: \>-  
          \--health-cmd pg\_isready  
          \--health-interval 10s  
          \--health-timeout 5s  
          \--health-retries 5  
        
      redis:  
        image: redis:7  
        ports: \['6379:6379'\]

    steps:  
      \- uses: actions/checkout@v4

      \- name: Setup PHP 8.3  
        uses: shivammathur/setup-php@v2  
        with:  
          php-version: '8.3'  
          extensions: pgsql, redis, mbstring, xml, curl, zip, bcmath  
          coverage: none

      \- name: Install Composer dependencies  
        run: composer install \--no-interaction \--prefer-dist \--optimize-autoloader

      \- name: Install NPM dependencies & build  
        run: npm ci **&&** npm run build

      \- name: Copy test env  
        run: cp .env.testing .env

      \- name: Generate app key  
        run: php artisan key:generate

      \- name: Run migrations (central)  
        run: php artisan migrate \--force  
        env:  
          DB\_HOST: 127.0.0.1  
          DB\_DATABASE: propreneur\_central\_test  
          DB\_USERNAME: propreneur  
          DB\_PASSWORD: test\_password

      \- name: Run Pest tests  
        run: ./vendor/bin/pest \--parallel  
        env:  
          DB\_HOST: 127.0.0.1  
          DB\_DATABASE: propreneur\_central\_test  
          DB\_USERNAME: propreneur  
          DB\_PASSWORD: test\_password  
          REDIS\_HOST: 127.0.0.1

### **`deploy-staging.yml` - deploy to v2 subdomain on merge to staging**

yaml  
name: Deploy to Staging

on:  
  push:  
    branches: \[staging\]

jobs:  
  deploy:  
    runs-on: ubuntu-latest  
    environment: staging

    steps:  
      \- uses: actions/checkout@v4

      \- name: Setup PHP 8.3  
        uses: shivammathur/setup-php@v2  
        with:  
          php-version: '8.3'  
          extensions: pgsql, redis, mbstring, xml, curl, zip, bcmath

      \- name: Install Composer dependencies (production optimised)  
        run: composer install \--no-dev \--no-interaction \--optimize-autoloader

      \- name: Install NPM & build assets  
        run: npm ci **&&** npm run build

      \- name: Deploy via SSH (rsync)  
        uses: burnett01/rsync-deployments@6.0.0  
        with:  
          switches: \-avzr \--delete \--exclude='.env' \--exclude='storage/' \--exclude='.git'  
          path: ./  
          remote\_path: ${{ secrets.STAGING\_PATH }}  
          remote\_host: ${{ secrets.STAGING\_HOST }}  
          remote\_user: ${{ secrets.STAGING\_USER }}  
          remote\_key: ${{ secrets.STAGING\_SSH\_KEY }}

      \- name: Run post-deploy commands on staging  
        uses: appleboy/ssh-action@v1.0.0  
        with:  
          host: ${{ secrets.STAGING\_HOST }}  
          username: ${{ secrets.STAGING\_USER }}  
          key: ${{ secrets.STAGING\_SSH\_KEY }}  
          script: |  
            cd ${{ secrets.STAGING\_PATH }}  
              
            \# Put app in maintenance mode  
            php artisan down \--retry=10  
              
            \# Run central DB migrations  
            php artisan migrate \--force  
              
            \# Run tenant DB migrations on all existing tenants  
            php artisan tenants:migrate \--force  
              
            \# Clear and rebuild caches  
            php artisan config:cache  
            php artisan route:cache  
            php artisan view:cache  
            php artisan event:cache  
              
            \# Restart queue workers  
            php artisan horizon:terminate  
            sudo supervisorctl restart horizon-staging  
              
            \# Sync Meilisearch indexes  
            php artisan scout:sync-index-settings  
              
            \# Bring app back up  
            php artisan up  
              
            echo "Staging deploy complete: $(date)"

### **`deploy-prod.yml` - same pattern, different secrets, extra diff check step**

Identical to staging deploy but using `PROD_*` secrets and adding a pre-deploy migration diff check (see Section 5 below).

---

## **4\. VPS Setup**

### **Server layout**

/var/www/  
  propreneur-v1/        → propreneur.co.uk     (existing v1, untouched)  
  propreneur-v2/        → v2.propreneur.co.uk  (your build target)  
    current/            → symlink → releases/20240501120000  
    releases/  
      20240501120000/  
      20240430090000/  
    shared/  
      .env              → never touched by deploy  
      storage/          → persists across releases

This is a simple **release-based deploy** - each deploy is a new directory, `current` symlink flips atomically. Instant rollback by flipping the symlink back.

### **Create deploy user (don't deploy as root)**

bash  
sudo adduser deploy  
sudo usermod \-aG www-data deploy

\# Add GitHub Actions public key to deploy user  
sudo \-u deploy mkdir \-p /home/deploy/.ssh  
sudo \-u deploy nano /home/deploy/.ssh/authorized\_keys  
\# Paste the PUBLIC key that matches STAGING\_SSH\_KEY secret  
sudo chmod 600 /home/deploy/.ssh/authorized\_keys

### **Nginx - two virtual hosts**

nginx  
\# /etc/nginx/sites-available/propreneur-v2  
server {  
    listen 80;  
    server\_name v2.propreneur.co.uk \*.v2.propreneur.co.uk;  
    return 301 https://$host$request\_uri;  
}

server {  
    listen 443 ssl http2;  
    server\_name v2.propreneur.co.uk \*.v2.propreneur.co.uk;  
      
    root /var/www/propreneur-v2/current/public;  
    index index.php;  
      
    ssl\_certificate     /etc/letsencrypt/live/v2.propreneur.co.uk/fullchain.pem;  
    ssl\_certificate\_key /etc/letsencrypt/live/v2.propreneur.co.uk/privkey.pem;  
      
    \# Security headers  
    add\_header X-Frame-Options "SAMEORIGIN";  
    add\_header X-Content-Type-Options "nosniff";  
    add\_header Referrer-Policy "strict-origin-when-cross-origin";  
      
    location / {  
        try\_files $uri $uri/ /index.php?$query\_string;  
    }  
      
    location \~ \\.php$ {  
        fastcgi\_pass unix:/var/run/php/php8.3-fpm.sock;  
        fastcgi\_param SCRIPT\_FILENAME $realpath\_root$fastcgi\_script\_name;  
        include fastcgi\_params;  
        fastcgi\_hide\_header X-Powered-By;  
    }  
      
    location \~ /\\.ht { deny all; }  
    location \~ /\\.env { deny all; }  
      
    \# Static assets with long cache  
    location \~\* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$ {  
        expires 1y;  
        add\_header Cache-Control "public, immutable";  
    }  
      
    client\_max\_body\_size 50M;  
}

The `*.v2.propreneur.co.uk` wildcard in `server_name` handles all tenant subdomains - `acme.v2.propreneur.co.uk`, `testco.v2.propreneur.co.uk` etc. all hit the same Nginx config.

For Cloudflare: set a wildcard DNS record `*.v2.propreneur.co.uk → VPS IP` and certbot wildcard cert:

bash  
sudo certbot certonly \--dns-cloudflare \\  
  \--dns-cloudflare-credentials \~/.secrets/cloudflare.ini \\  
  \-d v2.propreneur.co.uk \\  
  \-d \*.v2.propreneur.co.uk

### **Supervisor - Horizon queue workers**

ini  
\# /etc/supervisor/conf.d/horizon-staging.conf  
\[program:horizon-staging\]  
process\_name=%(program\_name)s  
command=php /var/www/propreneur-v2/current/artisan horizon  
autostart=true  
autorestart=true  
user=deploy  
redirect\_stderr=true  
stdout\_logfile=/var/www/propreneur-v2/shared/storage/logs/horizon.log  
stopwaitsecs=3600  
bash  
sudo supervisorctl reread  
sudo supervisorctl update  
sudo supervisorctl start horizon-staging

### **Laravel Scheduler - one cron entry**

bash  
\# crontab \-e (as deploy user)  
\* \* \* \* \* cd /var/www/propreneur-v2/current && php artisan schedule:run \>\> /dev/null **2**\>**&1**

### **VPS `.env` (staging)**

Lives at `/var/www/propreneur-v2/shared/.env` - never touched by deploys. The rsync excludes it. The `current` release symlinks to `shared/storage` and reads `shared/.env`.

env  
APP\_NAME=Propreneur  
APP\_ENV=staging  
APP\_DEBUG=false  
APP\_URL=https://v2.propreneur.co.uk

DB\_CONNECTION=pgsql  
DB\_HOST=127.0.0.1  
DB\_DATABASE=propreneur\_central  
DB\_USERNAME=propreneur\_app  
DB\_PASSWORD=\<strong\_password\>

TENANCY\_DB\_HOST=127.0.0.1  
TENANCY\_DB\_USERNAME=propreneur\_app  
TENANCY\_DB\_PASSWORD=\<strong\_password\>

\# Real API keys on staging (use sandbox where available)  
ANTHROPIC\_API\_KEY=...  
STRIPE\_KEY=pk\_test\_...   \# test keys on staging  
STRIPE\_SECRET=sk\_test\_...  
...  
---

## **5\. The Diff Check - Pre-Deploy Safety**

This is the step that prevents deploy disasters, especially with multi-tenant migrations where one bad migration runs against every tenant database.

### **Migration diff - what changed?**

Before any production deploy, run this locally or in CI:

bash  
\# See all pending migrations before deploying  
php artisan migrate:status

\# Dry-run - shows what WOULD run without executing  
php artisan migrate \--pretend \--force

For tenant migrations:

bash  
php artisan tenants:migrate \--pretend \--force

Add this as a **required check** in your `deploy-prod.yml` before the actual deploy step - fail the pipeline if there are unexpected pending migrations.

### **The sync confirmation script**

Create `scripts/pre-deploy-check.sh` and run it manually before every production merge:

bash  
**\#\!/bin/bash**  
echo "=== PRE-DEPLOY CHECK \==="  
echo ""

echo "1. Pending central migrations:"  
php artisan migrate:status | grep "Pending" || echo "   None pending"

echo ""  
echo "2. Pending tenant migrations (sample - first 3 tenants):"  
php artisan tenants:run "migrate:status" | head \-50

echo ""  
echo "3. Config diff (staging .env vs expected keys):"  
\# Check that all required keys exist in .env  
REQUIRED\_KEYS=("APP\_KEY" "DB\_PASSWORD" "ANTHROPIC\_API\_KEY" "STRIPE\_SECRET" \\  
               "TENANCY\_DB\_PASSWORD" "REDIS\_PASSWORD" "MEILISEARCH\_KEY")  
for key in "${REQUIRED\_KEYS\[@\]}"; do  
  grep \-q "^${key}=" .env && echo "   ✓ ${key}" || echo "   ✗ MISSING: ${key}"  
done

echo ""  
echo "4. Queue health:"  
php artisan horizon:status

echo ""  
echo "5. Last deploy timestamp:"  
cat storage/deploy.txt **2**\>/dev/null || echo "   No previous deploy recorded"

echo ""  
echo "=== Ready to deploy? (y/n) \==="  
read answer  
if \[ "$answer" \!= "y" \]; then  
  echo "Deploy cancelled."  
  exit 1  
fi

### **Post-deploy smoke test**

After every deploy, GitHub Actions runs a smoke test hit against the staging URL:

yaml  
\- name: Smoke test  
  run: |  
    sleep 10  \# wait for app to come up  
      
    \# Check the app responds  
    STATUS=$(curl \-s \-o /dev/null \-w "%{http\_code}" https://v2.propreneur.co.uk)  
    if \[ "$STATUS" \!= "200" \]; then  
      echo "SMOKE TEST FAILED - HTTP $STATUS"  
      exit 1  
    fi  
      
    \# Check health endpoint  
    curl \-f https://v2.propreneur.co.uk/health || exit 1  
      
    echo "Smoke test passed - HTTP $STATUS"

Add a `/health` endpoint in `routes/web.php`:

php  
Route::get('/health', function () {  
    return response()-\>json(\[  
        'status' \=\> 'ok',  
        'db' \=\> DB::connection()-\>getPdo() ? 'connected' : 'error',  
        'cache' \=\> Cache::store('redis')-\>put('health\_check', true, 10\) ? 'ok' : 'error',  
        'timestamp' \=\> now()-\>toISOString(),  
    \]);  
});

### **Instant rollback**

If smoke test fails or something is wrong post-deploy:

bash  
\# On VPS - flip symlink to previous release  
ls /var/www/propreneur-v2/releases/        \# see all releases  
ln \-sfn /var/www/propreneur-v2/releases/20240430090000 /var/www/propreneur-v2/current  
sudo supervisorctl restart horizon-staging  
php artisan config:cache

The previous release is kept for 3 deploys then cleaned up automatically.

---

## **6\. Multi-Tenancy Specific Considerations**

### **Wildcard subdomain DNS**

Cloudflare - add two records:

v2.propreneur.co.uk       A    → VPS IP   (proxied)  
\*.v2.propreneur.co.uk     A    → VPS IP   (proxied)

### **stancl/tenancy config**

php  
// config/tenancy.php - key settings  
'central\_domains' \=\> \[  
    'v2.propreneur.co.uk',  // the marketing/login page  
\],

'tenant\_database\_manager' \=\> Stancl\\Tenancy\\Database\\TenantDatabaseManagers\\PostgreSQLDatabaseManager::class,

// Tenant DB naming pattern  
'database' \=\> \[  
    'prefix' \=\> 'propreneur\_t\_',  
    'suffix' \=\> '',  
\],

### **Separate migrations directories**

database/  
  migrations/  
    2024\_01\_01\_000001\_create\_tenants\_table.php     ← central  
    2024\_01\_01\_000002\_create\_domains\_table.php     ← central  
    2024\_01\_01\_000003\_create\_subscriptions\_table.php  
  migrations/tenant/  
    2024\_01\_02\_000001\_create\_users\_table.php       ← tenant  
    2024\_01\_02\_000002\_create\_properties\_table.php  ← tenant  
    ... all 30+ tenant tables

In `AppServiceProvider`:

php  
Tenancy::runMigrationsAfterCreatingTenant(true);

This auto-runs all tenant migrations when a new tenant DB is created on sign-up.

### **Testing multi-tenancy locally**

php  
// tests/Feature/TenancyTest.php  
it('isolates tenant data correctly', function () {  
    $tenant1 \= Tenant::create(\['id' \=\> 'tenant1'\]);  
    $tenant2 \= Tenant::create(\['id' \=\> 'tenant2'\]);  
      
    tenancy()-\>initialize($tenant1);  
    Property::factory()-\>create(\['address\_line1' \=\> 'Tenant 1 Property'\]);  
      
    tenancy()-\>initialize($tenant2);  
    expect(Property::count())-\>toBe(0); // tenant 2 sees nothing  
      
    tenancy()-\>end();  
});  
---

## **Summary - The Full Flow in Practice**

1\. Start work on a feature  
   git checkout staging  
   git pull  
   git checkout \-b feature/DEAL-02-deal-detail

2\. Build locally, test locally  
   php artisan test  
     
3\. Push and open PR to staging  
   git push origin feature/DEAL-02-deal-detail  
   \# GitHub runs test.yml - must pass

4\. Merge PR to staging  
   \# deploy-staging.yml fires automatically  
   \# rsync → VPS → migrate → cache → horizon restart → smoke test  
   \# v2.propreneur.co.uk is updated in \~90 seconds

5\. Test on staging (real URL, real subdomain, real tenants)  
   \# If something is wrong: fix on a new feature branch, repeat

6\. When staging is stable: open PR staging → main  
   \# Run pre-deploy-check.sh locally first  
   \# Review migration diff  
   \# Merge → deploy-prod.yml fires → production updated  
   \# Smoke test runs  
   \# Previous release kept for instant rollback

The entire pipeline from `git push` to live on staging should be under 2 minutes. That's the feedback loop that makes solo development sustainable across 18 months.

