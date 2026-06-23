# Sprint 7 - Prompt 02: Security Hardening

**Sprint:** 7 - Infrastructure
**Prompt number:** 02 of 04
**Name:** Nginx configs, HTTPS, admin IP allowlist, admin TOTP, CSP/HSTS, rate limiting, firewall
**Primary agent:** Claude Code
**Estimated hours:** 8-10 h
**Depends on:** Nothing. Can build independently.

---

## Post-build (MANDATORY)

When all "Done When" criteria below are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Add a "**What was built:**" bullet list.
3. Move this file to `internal/prompts/archived_prompts/pending_prompts/sprint-7/infra/`.

---

## Read First

1. `frontends/client-apps/admin.carinaai.uk/src/app/api/auth/login/route.ts` - the admin login route built in sprint-6; TOTP verification goes here
2. `backends/servers/core.carinaai.uk/src/billing/webhooks/stripe-webhook.ts` - confirm Stripe signature verification; add it if missing
3. Run `cat /etc/nginx/sites-available/*` on VPS to see existing Nginx config before overwriting
4. Run `ufw status` on VPS to understand current firewall state
5. Run `certbot certificates` on VPS to see existing SSL certs

---

## Context

Three distinct security concerns are addressed in this prompt:

1. **Network level:** Firewall rules (ufw), Nginx restricting the admin app to known IPs.
2. **Transport level:** HTTPS on all four domains with auto-renewing Let's Encrypt certs,
   HSTS headers, strict TLS settings.
3. **Application level:** CSP headers per app, Nginx-level rate limiting on auth endpoints,
   admin TOTP (2FA), Stripe webhook signature verification, CORS lockdown.

These are applied in layers. A request to `admin.carinaai.uk` from an unknown IP is rejected
at the Nginx IP allowlist before the Next.js app even sees it. A valid-IP request still needs
a password and a TOTP code. A valid session still operates within CSP constraints.

---

## Step 1: Firewall (ufw)

On the VPS, ensure only necessary ports are open:

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (for certbot ACME challenges and redirect to HTTPS)
ufw allow 443/tcp   # HTTPS
ufw enable
ufw status verbose
```

Do NOT open ports 3000, 3001, or 4000 to the public. All app traffic reaches those ports only
through Nginx on localhost.

PostgreSQL port 5432: must be bound to `127.0.0.1` only. Verify:
```bash
grep listen_addresses /etc/postgresql/*/main/postgresql.conf
# Should show: listen_addresses = 'localhost'
# If it shows '*', change it and restart PostgreSQL
```

Document these ufw rules in `infrastructure/VPS-SETUP.md`.

---

## Step 2: Nginx base configuration

Create `/etc/nginx/conf.d/security-defaults.conf`:

```nginx
# Applied to all virtual hosts via include

# TLS settings
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers on;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 1d;
ssl_session_tickets off;
ssl_stapling on;
ssl_stapling_verify on;
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;

# Common security headers (can be overridden per-server block)
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;

# Rate limit zones (referenced in individual server blocks)
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=api:10m rate=60r/m;
limit_req_zone $binary_remote_addr zone=global:10m rate=120r/m;
```

---

## Step 3: HTTP to HTTPS redirect (all domains)

Create `/etc/nginx/sites-available/redirect-http`:

```nginx
server {
    listen 80;
    server_name carinaai.uk app.carinaai.uk core.carinaai.uk admin.carinaai.uk;
    return 301 https://$host$request_uri;
}
```

---

## Step 4: carinaai.uk Nginx config

Create `/etc/nginx/sites-available/carinaai.uk`:

```nginx
server {
    listen 443 ssl;
    server_name carinaai.uk www.carinaai.uk;

    ssl_certificate /etc/letsencrypt/live/carinaai.uk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/carinaai.uk/privkey.pem;
    include /etc/nginx/conf.d/security-defaults.conf;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';" always;

    root /var/www/carinaai.uk;
    index index.html;

    location / {
        try_files $uri $uri/ $uri.html =404;
    }

    location /aiva/ {
        try_files $uri $uri/ /aiva/index.html;
    }

    # Block dotfiles
    location ~ /\. {
        deny all;
    }

    # Static asset caching
    location ~* \.(css|js|png|jpg|jpeg|gif|svg|ico|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## Step 5: app.carinaai.uk Nginx config

Create `/etc/nginx/sites-available/app.carinaai.uk`:

```nginx
server {
    listen 443 ssl;
    server_name app.carinaai.uk;

    ssl_certificate /etc/letsencrypt/live/app.carinaai.uk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.carinaai.uk/privkey.pem;
    include /etc/nginx/conf.d/security-defaults.conf;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.stripe.com wss://app.carinaai.uk; frame-src https://js.stripe.com https://hooks.stripe.com; frame-ancestors 'none';" always;

    client_max_body_size 10M;

    # Auth endpoints - strict rate limiting
    location ~ ^/api/auth/ {
        limit_req zone=auth burst=3 nodelay;
        limit_req_status 429;
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Stripe webhook - no rate limiting (Stripe may retry)
    location /api/webhooks/stripe {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # All other API routes
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        limit_req_status 429;
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        limit_req zone=global burst=30 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";  # for SSE and WebSocket
        proxy_read_timeout 300s;
        proxy_buffering off;  # required for SSE
    }

    location ~ /\. {
        deny all;
    }
}
```

---

## Step 6: core.carinaai.uk Nginx config

Create `/etc/nginx/sites-available/core.carinaai.uk`:

```nginx
server {
    listen 443 ssl;
    server_name core.carinaai.uk;

    ssl_certificate /etc/letsencrypt/live/core.carinaai.uk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/core.carinaai.uk/privkey.pem;
    include /etc/nginx/conf.d/security-defaults.conf;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    # Core is an API only - no browser navigation, strictest possible CSP
    add_header Content-Security-Policy "default-src 'none';" always;

    client_max_body_size 20M;  # for audio uploads (transcription)

    # CORS handled by the application; Nginx does not add CORS headers here
    # to avoid double-header conflicts

    # Stripe webhook - no rate limiting
    location /api/webhooks/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/admin/ {
        # Admin API is called only by the admin Next.js app (127.0.0.1:3001)
        # and by the admin Next.js API routes which run server-side
        # The ADMIN_CORE_URL env var in the admin app should be http://127.0.0.1:4000
        # so these requests never hit this public Nginx block
        # Block any direct public access to /api/admin/*
        deny all;
    }

    location / {
        limit_req zone=api burst=30 nodelay;
        limit_req_status 429;
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
        proxy_buffering off;
    }

    location ~ /\. {
        deny all;
    }
}
```

---

## Step 7: admin.carinaai.uk Nginx config (IP restricted)

Create `/etc/nginx/sites-available/admin.carinaai.uk`:

```nginx
# VERLOX team IP allowlist - update this list when team IPs change
# Each line: allow <IP>;  (IPv4 or IPv6, CIDR notation ok)
# After updating, run: nginx -t && systemctl reload nginx

geo $admin_allowed {
    default 0;
    # --- VERLOX team IPs - replace these placeholders with real IPs ---
    # 203.0.113.10  1;   # VERLOX office
    # 198.51.100.5  1;   # team member home
    # Add more as needed
}

server {
    listen 443 ssl;
    server_name admin.carinaai.uk;

    ssl_certificate /etc/letsencrypt/live/admin.carinaai.uk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.carinaai.uk/privkey.pem;
    include /etc/nginx/conf.d/security-defaults.conf;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';" always;
    # No Stripe CSP exception needed - admin app does not load Stripe.js

    # Block all non-allowlisted IPs before the app sees the request
    if ($admin_allowed = 0) {
        return 403;
    }

    # Auth endpoint - very strict rate limiting
    location /api/auth/login {
        limit_req zone=auth burst=2 nodelay;
        limit_req_status 429;
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
        proxy_buffering off;
    }

    location ~ /\. {
        deny all;
    }
}
```

Create `infrastructure/docs/ADMIN-IP-ALLOWLIST.md`:

```markdown
# Admin IP Allowlist

File: `/etc/nginx/sites-available/admin.carinaai.uk`

To add a new IP:
1. Add a line: `<IP>  1;` inside the `geo $admin_allowed` block
2. Run: `nginx -t` to verify config
3. Run: `systemctl reload nginx` to apply

To verify access: `curl -I https://admin.carinaai.uk` from the IP - should return 200 or 302.
From a non-allowlisted IP it should return 403.

Current allowlisted IPs: [update this doc when you update Nginx]
```

---

## Step 8: Let's Encrypt SSL certs

On the VPS (certbot must be installed: `apt install certbot python3-certbot-nginx`):

```bash
certbot --nginx \
  -d carinaai.uk -d www.carinaai.uk \
  -d app.carinaai.uk \
  -d core.carinaai.uk \
  -d admin.carinaai.uk \
  --email lordsesame@gmail.com \
  --agree-tos \
  --no-eff-email
```

Certbot will edit the Nginx configs to add certificate paths and set up auto-renewal.

Verify auto-renewal is scheduled:
```bash
systemctl status certbot.timer
# or
crontab -l | grep certbot
```

If not present, add a cron:
```
0 3 * * * certbot renew --quiet --post-hook "systemctl reload nginx"
```

Test renewal: `certbot renew --dry-run`

Document cert expiry dates in `infrastructure/VPS-SETUP.md`.

---

## Step 9: Admin TOTP (2FA)

Extend the admin app from sprint-6 to require TOTP after password verification.

**DB columns** (add to migration `009-aiva-admin.sql` or a new `010-admin-totp.sql`):
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_verified_at TIMESTAMPTZ;
```

**Install on admin app:**
```bash
npm install otplib qrcode
npm install --save-dev @types/qrcode
```

**Login flow change** (`src/app/api/auth/login/route.ts`):

After password verification succeeds:
1. If `totp_enabled = false` on the user: issue a temporary "pending-totp-setup" session cookie
   (not a full admin session), redirect to `/totp-setup`
2. If `totp_enabled = true`: issue a temporary "pending-totp" session cookie, redirect to `/totp-verify`
3. Full admin session is only issued after TOTP is verified

**`src/app/(auth)/totp-setup/page.tsx`** (new page):

```
[heading]  Set up two-factor authentication
[body]     Scan this QR code with your authenticator app (Google Authenticator, Authy, or 1Password).

[QR code image]
[Secret key text - for manual entry]

[6-digit code input]
[Verify and activate button]
```

On load: call `GET /api/auth/totp/setup` which generates a new `totp_secret` with `otplib`,
stores it in the user row (not yet enabled), and returns a QR code data URL.

On submit: call `POST /api/auth/totp/setup/verify` with the 6-digit code.
- Verify the code against the stored secret using `otplib.authenticator.verify()`
- If valid: set `totp_enabled = true`, `totp_verified_at = NOW()`, issue full admin session
- If invalid: return 400 "Invalid code. Try again."

**`src/app/(auth)/totp-verify/page.tsx`** (new page):

```
[heading]  Enter your authenticator code
[6-digit input - auto-focuses, numeric keyboard on mobile]
[Verify button]
```

On submit: call `POST /api/auth/totp/verify` with the code.
- Verify against the stored secret
- If valid: issue full admin session, redirect to `/customers`
- If invalid: increment a failed TOTP attempt counter (stored in the pending session)
- After 5 failed attempts: invalidate the pending session, redirect to `/login` with message
  "Too many failed attempts. Please log in again."

**`src/app/api/auth/totp/` routes:**

```
GET  /api/auth/totp/setup          Generate secret, store in user row, return QR URL
POST /api/auth/totp/setup/verify   Verify code, enable TOTP, issue full session
POST /api/auth/totp/verify         Verify code on login, issue full session
```

All three routes require the "pending-totp" or "pending-totp-setup" session cookie.
They must not be accessible with a full admin session or no session.

---

## Step 10: Stripe webhook signature verification

In `backends/servers/core.carinaai.uk/src/billing/webhooks/stripe-webhook.ts`:

Verify that every webhook handler starts with:
```typescript
const sig = req.headers['stripe-signature'];
let event: Stripe.Event;
try {
  event = stripe.webhooks.constructEvent(
    req.rawBody,   // MUST be the raw Buffer, not parsed JSON
    sig,
    process.env.STRIPE_WEBHOOK_SECRET,
  );
} catch (err) {
  return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
}
```

If `req.rawBody` is not available because the body parser has already parsed the request,
configure the webhook route to use `express.raw({ type: 'application/json' })` middleware
instead of `express.json()`.

If signature verification is already implemented, confirm it and add a test:
```typescript
// Test: sending a webhook request without a valid signature should return 400
// Test: sending a webhook with a tampered body should return 400
```

If it is not implemented, add it now. This prevents anyone from sending fake payment events
to your backend.

---

## Step 11: CORS lockdown in core backend

In `core.carinaai.uk`, find the CORS configuration. Ensure the allowed origins list is:

```typescript
const ALLOWED_ORIGINS = [
  'https://app.carinaai.uk',
  'https://admin.carinaai.uk',
  'https://carinaai.uk',
  // Development only - gate on NODE_ENV
  ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000', 'http://localhost:3001'] : []),
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Token', 'X-Scout-Token'],
}));
```

Do not use `origin: '*'`. Wildcard CORS with `credentials: true` is rejected by browsers anyway,
but wildcard without credentials allows cross-site data leakage from public endpoints.

---

## Step 12: Fail2ban for SSH and Nginx auth failures

Install fail2ban: `apt install fail2ban`

Create `/etc/fail2ban/jail.local`:

```ini
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port    = 22
filter  = sshd
logpath = /var/log/auth.log

[nginx-auth]
enabled  = true
port     = http,https
filter   = nginx-auth
logpath  = /var/log/nginx/error.log
maxretry = 10
findtime = 5m
bantime  = 30m
```

Create `/etc/fail2ban/filter.d/nginx-auth.conf`:

```ini
[Definition]
failregex = limiting requests, excess:.* by zone.*client: <HOST>
ignoreregex =
```

```bash
systemctl enable fail2ban
systemctl start fail2ban
fail2ban-client status
```

---

## Done When

- [ ] ufw rules set: only 22, 80, 443 open; PostgreSQL bound to 127.0.0.1
- [ ] `/etc/nginx/conf.d/security-defaults.conf` exists with TLS settings and rate limit zones
- [ ] HTTP-to-HTTPS redirect active for all four domains
- [ ] `carinaai.uk` Nginx config: HTTPS, HSTS, CSP, static file caching
- [ ] `app.carinaai.uk` Nginx config: HTTPS, HSTS, CSP with Stripe frame-src, SSE proxy_buffering off, auth rate limit zone
- [ ] `core.carinaai.uk` Nginx config: HTTPS, HSTS, `/api/admin/*` blocked from public, webhook route exempt from rate limiting
- [ ] `admin.carinaai.uk` Nginx config: HTTPS, HSTS, IP allowlist via geo block, 403 for non-allowlisted IPs
- [ ] `ADMIN-IP-ALLOWLIST.md` documents how to add/remove IPs
- [ ] Let's Encrypt certs issued for all four domains; auto-renewal verified with `certbot renew --dry-run`
- [ ] TOTP setup page renders QR code; code verification enables TOTP on the user row
- [ ] TOTP verify page shown on every admin login after TOTP is enabled
- [ ] 5 failed TOTP attempts invalidates the pending session and forces re-login
- [ ] Login without TOTP (password only) never issues a full admin session
- [ ] Stripe webhook signature verification implemented in core; unsigned requests return 400
- [ ] CORS allowed origins list is explicit; wildcard not used
- [ ] fail2ban active; SSH and Nginx auth filters configured
- [ ] `nginx -t` passes with no warnings after all config changes
- [ ] `nginx -T` output reviewed to confirm no unintended `add_header` conflicts (Nginx inherits vs overrides)
- [ ] No TOTP secrets logged anywhere (not in PM2 logs, not in Next.js response bodies)
