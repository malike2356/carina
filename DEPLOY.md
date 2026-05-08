# Carina AI — Deployment Guide

**Domain:** carinaai.uk  
**DNS/CDN:** Cloudflare  
**Server:** Contabo VPS (shared with Propreneur)  
**Method:** Docker Compose

---

## Step 1: Cloudflare DNS Records

In your Cloudflare dashboard for carinaai.uk, go to **DNS > Records** and add:

| Type  | Name   | Content           | Proxy   | TTL  |
|-------|--------|-------------------|---------|------|
| A     | @      | YOUR.VPS.IP.HERE  | Proxied | Auto |
| A     | www    | YOUR.VPS.IP.HERE  | Proxied | Auto |
| A     | *      | YOUR.VPS.IP.HERE  | Proxied | Auto |

The `*` wildcard record covers all tenant subdomains (e.g. `john.carinaai.uk`).

**Important:** Set all records to **Proxied** (orange cloud). This hides your VPS IP and enables Cloudflare SSL.

---

## Step 2: Cloudflare SSL/TLS Settings

### 2a. Set SSL mode
Go to **SSL/TLS > Overview** and select: **Full (Strict)**

This encrypts traffic between Cloudflare and your VPS, and requires a valid origin certificate.

### 2b. Generate Origin Certificate
Go to **SSL/TLS > Origin Server > Create Certificate**

Settings:
- Hostnames: `carinaai.uk`, `*.carinaai.uk`
- Key type: RSA (2048)
- Expiry: 15 years

Download:
- **Certificate** → save as `carinaai.uk.pem`
- **Private key** → save as `carinaai.uk.key`

### 2c. Enable HSTS (optional but recommended)
Go to **SSL/TLS > Edge Certificates**:
- Enable **Always Use HTTPS**
- Enable **HSTS** (max-age 6 months is enough for now)

---

## Step 3: VPS Server Setup

SSH into your Contabo VPS:

```bash
ssh root@YOUR.VPS.IP.HERE
```

### Install Docker (if not already installed)
```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
```

### Install Docker Compose plugin
```bash
apt-get install -y docker-compose-plugin
docker compose version  # verify
```

### Create SSL directory and upload cert files
```bash
mkdir -p /etc/carina/ssl
```

From your local machine, upload the cert files:
```bash
scp carinaai.uk.pem root@YOUR.VPS.IP:/etc/carina/ssl/
scp carinaai.uk.key root@YOUR.VPS.IP:/etc/carina/ssl/
chmod 600 /etc/carina/ssl/carinaai.uk.key
```

---

## Step 4: Deploy Carina

### Clone the repository
```bash
cd /var/www
git clone https://github.com/malike2356/carina-ai.git carina-ai
cd carina-ai
```

### Create the production .env
```bash
cp laravel/.env.production.example laravel/.env
nano laravel/.env
```

Fill in:
- `APP_KEY` — run `php artisan key:generate --show` to get one (or generate in container)
- `DB_PASSWORD` — a strong random password
- `MEILISEARCH_KEY` / `MEILI_KEY` — same strong random string
- AI provider keys (DeepSeek, OpenAI, Anthropic etc.)

### Build and start
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### Generate app key (first time only)
```bash
docker compose exec laravel php artisan key:generate
```

### Verify everything is running
```bash
docker compose ps
docker compose logs laravel --tail=30
```

---

## Step 5: Verify Live

```bash
# Health check (from VPS)
curl https://carinaai.uk/up
# → {"timestamp":"...","..."}

# Python ML engine
curl https://carinaai.uk/py/health
# → {"status":"ok","service":"carina-python","version":"0.1.0"}
```

Open **https://carinaai.uk** in a browser — you should see the Carina login page over HTTPS.

---

## Ongoing Operations

### Deploy updates
```bash
cd /var/www/carina-ai
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build laravel python-api
```

### Run migrations after deploy
```bash
docker compose exec laravel php artisan migrate --force
```

### View logs
```bash
docker compose logs -f laravel
docker compose logs -f python-api
docker compose logs -f celery
```

### Restart a service
```bash
docker compose restart laravel
```

### Connect to database
```bash
docker compose exec postgres psql -U carina -d carina_central
```

---

## Port Summary (Production)

| Port | Exposed? | Service |
|------|----------|---------|
| 80   | Yes (host) | nginx — HTTP, redirects to HTTPS |
| 443  | Yes (host) | nginx — HTTPS via Cloudflare Origin Cert |
| 5432 | No | PostgreSQL — internal only |
| 6379 | No | Redis — internal only |
| 7700 | No | Meilisearch — internal only |
| 8001 | No | Python FastAPI — internal only |
| 9000 | No | PHP-FPM — internal only |

Cloudflare sits in front of ports 80 and 443. All other ports are private.

---

## Firewall (UFW)

On the VPS, only open the ports Cloudflare needs:

```bash
ufw allow 22/tcp     # SSH
ufw allow 80/tcp     # HTTP (Cloudflare)
ufw allow 443/tcp    # HTTPS (Cloudflare)
ufw enable
```

To lock down port 443 to Cloudflare IPs only (optional but best practice):
```bash
# Allow only Cloudflare IP ranges on 443
for ip in 103.21.244.0/22 103.22.200.0/22 103.31.4.0/22 104.16.0.0/13 104.24.0.0/14 108.162.192.0/18 131.0.72.0/22 141.101.64.0/18 162.158.0.0/15 172.64.0.0/13 173.245.48.0/20 188.114.96.0/20 190.93.240.0/20 197.234.240.0/22 198.41.128.0/17; do
  ufw allow from $ip to any port 443
done
ufw delete allow 443/tcp  # remove the broad rule after adding CF ranges
```

---

## Coexistence with Propreneur

Carina and Propreneur share the same VPS. They use different Docker networks and different ports. No conflicts.

| Product | Domain | Docker Network | DB |
|---------|--------|----------------|-----|
| Propreneur | propreneur.co.uk | propreneur_network | propreneur_* |
| Carina | carinaai.uk | carina-ai_carina | carina_central + tenant* |

The Contabo VPS has 8 vCPU and 16 GB RAM — enough for both products at MVP scale.
