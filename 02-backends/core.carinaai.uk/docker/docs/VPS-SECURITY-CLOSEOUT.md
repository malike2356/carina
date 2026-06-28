# VPS security closeout (prompt 02)

Repository configs for nginx, TOTP, CORS, Stripe verification, and fail2ban filters are in git.
Run these **once on the VPS** after deploy.

## 1. Host firewall and fail2ban

```bash
cd /home/malike/apps/core.carinaai.uk
sudo bash docker/scripts/vps-hardening.sh
```

Copy fail2ban nginx filter (if not already on host):

```bash
sudo cp docker/nginx/fail2ban/nginx-auth.conf /etc/fail2ban/filter.d/
sudo cp docker/nginx/fail2ban/nginx-botsearch.conf /etc/fail2ban/filter.d/
```

Add to `/etc/fail2ban/jail.local`:

```ini
[nginx-auth]
enabled  = true
port     = http,https
filter   = nginx-auth
logpath  = /var/log/nginx/error.log
maxretry = 10
findtime = 5m
bantime  = 30m
```

```bash
sudo systemctl restart fail2ban
sudo fail2ban-client status nginx-auth
```

## 2. Admin IP allowlist

**After GTM setup only.** See `docker/config/gtm-rollout.json` and `ADMIN-IP-ALLOWLIST.md`. Leave `NGINX_ADMIN_IP_ALLOWLIST=false` during launch.

## 3. TLS certificates

```bash
sudo certbot renew --dry-run
```

Document expiry in deploy notes if needed.

## 4. Admin app + TOTP smoke test

```bash
# After carina-admin is up:
curl -fsS https://admin.carinaai.uk/api/health
```

Sign in at `https://admin.carinaai.uk/login`, complete TOTP setup, sign out, sign in again with TOTP.

## 5. PostgreSQL

Confirm Postgres is not exposed publicly (Docker internal network only):

```bash
ss -tlnp | grep 5432 || true
```
