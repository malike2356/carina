# Security Hardening; DDoS & Rate Limiting

**Audit date:** 13 June 2026
**Status:** URGENT; zero application-layer protection across all surfaces

---

## Current State

### What you HAVE (Cloudflare free tier)
- L3/L4 volumetric DDoS protection (SYN floods, UDP floods, amplification)
- TLS termination at the edge
- Real IP passed via `CF-Connecting-IP` (nginx cloudflare.inc loaded)

### What you DON'T HAVE
- Failed:  No rate limiting on any endpoint (Cloudflare, nginx, or app level)
- Failed:  No WAF rules (SQLi, XSS, bad bots, scrapers; nothing blocked)
- Failed:  No per-IP throttling
- Failed:  No fail2ban (installed but not running)
- Failed:  No ModSecurity / NAXSI (not compiled into nginx)
- Failed:  No `limit_req_zone` or `limit_conn_zone` in nginx configs
- Failed:  No rate-limiting middleware in Carina Node.js apps

---

## Affected Surfaces

| Domain | Type | Backend | Rate Limited? |
|--------|------|---------|---------------|
| carinaai.uk | Static HTML | nginx → files | Failed:  |
| core.carinaai.uk | API + billing | nginx → :3333 (Node) | Failed:  |
| ops.carinaai.uk | Operator console | nginx → :4001 (Node) | Failed:  |
| console.labyrinthscout.com | Dashboard + API | nginx → :4444 (Node) | Failed:  |
| labyrinthscout.com | Static HTML | nginx → files | Failed:  |
| propreneur.uk | Laravel app | nginx → PHP-FPM | Failed:  |
| tuinapp.co.uk | Next.js | nginx → Node | Failed:  |

**Every endpoint on the server is unprotected at L7.**

---

## Immediate Actions (no code changes needed)

### 1. Cloudflare WAF; Rate Limiting Rule (free tier: 1 rule)
- Security → WAF → Rate limiting rules
- Field: **URI Path** → contains `/api/`
- Or combine: `(http.host eq "core.carinaai.uk" or http.host eq "ops.carinaai.uk" or http.host eq "console.labyrinthscout.com")`
- Threshold: **100 requests per 10 seconds** per IP
- Action: **Block** (or JS Challenge for less aggressive)
- Duration: 30 seconds

### 2. Cloudflare WAF; Managed Ruleset (free tier includes OWASP core)
- Security → WAF → Managed rules
- Enable **Cloudflare OWASP Core Ruleset**
- Set to **Simulate** first, review logs, then **Block**

### 3. Cloudflare; Security Level
- Security → Settings → Security Level: **Medium** (challenges suspicious visitors)
- Challenge Passage: 30 minutes

### 4. Cloudflare; Bot Fight Mode
- Security → Bots → **Bot Fight Mode: On** (free tier)
- Blocks confirmed bots; challenges suspected ones

---

## Server-Level Actions (later, requires config changes)

### 5. Enable fail2ban
```bash
sudo systemctl enable fail2ban --now
sudo fail2ban-client status
```
Create nginx-ratelimit jail for 429/403 floods.

### 6. Nginx rate limiting (global)
Add to `/etc/nginx/nginx.conf` http block:
```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=static:10m rate=30r/s;
limit_conn_zone $binary_remote_addr zone=connlimit:10m;
```
Apply to proxy locations:
```nginx
location /api/ {
    limit_req zone=api burst=20 nodelay;
    limit_conn connlimit 10;
    proxy_pass ...;
}
```

### 7. Carina app-level middleware (Node.js)
Add `express-rate-limit` to core and ops Express apps. 100 req/min per IP for API routes, 30 req/min for auth routes.

---

## Risk If Left Unfixed

- **Brute force:** An attacker can hammer login/API endpoints with unlimited requests
- **Resource exhaustion:** Node.js processes can be overwhelmed; no backpressure at any layer
- **Cost amplification:** Carina's tool calls (email, PDF, AI inference) are unbounded; an attacker could rack up API bills
- **Origin exposure:** If Cloudflare IPs are bypassed (common), the server is completely naked
- **Scraping:** No bot protection means competitors or AI scrapers can mirror your entire site

---

## Priority Order

1.  Cloudflare Rate Limiting Rule (5 minutes, free, instant effect)
2.  Cloudflare Bot Fight Mode (1 click)
3.  Cloudflare Security Level → Medium (1 click)
4.  Cloudflare OWASP Managed Ruleset (enable, simulate 24h, then block)
5.  fail2ban enable (server-level, requires sudo)
6.  Nginx rate limiting (requires config edit + reload)
7.  App-level middleware (requires code deploy)
