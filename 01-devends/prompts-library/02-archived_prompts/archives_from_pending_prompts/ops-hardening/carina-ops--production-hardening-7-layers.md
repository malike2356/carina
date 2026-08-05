# Carina Prompt: Production Hardening; Don't Fall Apart When Users Show Up

**Status: COMPLETED 2026-07-26**

**What was built:**
- Redis rate limits (login/signup/ai/api/webhook)
- Auth hardening (lockout, suspicious IP, audit, session revoke)
- Workspace access audit helpers; RLS deferred with docs
- `scan-secrets.sh`, LLM circuit breaker, Redis job queue + SSE
- k6 smoke load test + `docs/production-hardening.md`

## Status: PENDING

## Source
Facebook Reel: "How to build an app that ACTUALLY works when users start using it"; SWErikCodes (82K views)
Video: https://www.facebook.com/share/r/1CnmiY1fo7/

---

## Summary

Implement 7 production hardening layers across Carina Cloud (app.carinaai.uk), Carina Ops (ops.carinaai.uk), Carina API (core.carinaai.uk), and Aiva. Shipping is step one. Not falling apart when users actually use it is the more important part.

---

## The 7 Hardening Layers

### 1. Rate Limiting; Stop Spam Before It Starts

```
                    ┌─────────────────────┐
                    │   RATE LIMITER       │
                    │                     │
  User → Too fast → │  LOGIN:   5/min/IP  │ → 429 + cooldown
  Bot →  Abusing  → │  SIGNUP:  3/hr/IP   │ → 429 + captcha
  Scraper →        │  AI API:  30/min/user│ → 429 + backoff
                    │  API:     100/min/IP │ → 429 + retry-after
                    │  WEBHOOK: 60/min     │ → 429
                    └─────────────────────┘
```

```python
# core.carinaai.uk/middleware/rate_limiter.py
from functools import wraps
from flask import request, jsonify, g
import time, redis

redis_client = redis.Redis(host='localhost', port=6379, db=1)

RATE_LIMITS = {
    'login':    {'max': 5,   'window': 60},     # 5 per minute
    'signup':   {'max': 3,   'window': 3600},   # 3 per hour
    'ai_api':   {'max': 30,  'window': 60},     # 30 per minute per user
    'api':      {'max': 100, 'window': 60},     # 100 per minute per IP
    'webhook':  {'max': 60,  'window': 60},     # 60 per minute
}

def rate_limit(endpoint: str):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            limits = RATE_LIMITS.get(endpoint, RATE_LIMITS['api'])
            key = f"ratelimit:{endpoint}:{request.remote_addr}"
            if g.get('user_id'):
                key = f"ratelimit:{endpoint}:user:{g.user_id}"

            current = redis_client.get(key)
            if current and int(current) >= limits['max']:
                retry_after = redis_client.ttl(key)
                return jsonify({
                    'error': 'rate_limit_exceeded',
                    'retry_after_seconds': retry_after,
                    'message': f'Too many requests. Try again in {retry_after}s.'
                }), 429

            pipe = redis_client.pipeline()
            pipe.incr(key)
            pipe.expire(key, limits['window'])
            pipe.execute()
            return f(*args, **kwargs)
        return wrapper
    return decorator

# Apply to routes
@app.route('/api/auth/login', methods=['POST'])
@rate_limit('login')
def login(): ...

@app.route('/api/auth/register', methods=['POST'])
@rate_limit('signup')
def register(): ...

@app.route('/api/agent/chat', methods=['POST'])
@rate_limit('ai_api')
def agent_chat(): ...
```

### 2. Real Auth Provider; Don't Roll Your Own

```
┌──────────────────────────────────────────────────────────┐
│              AUTH GATEWAY                                 │
│                                                          │
│  User → /api/auth/login                                   │
│         │                                                 │
│         ├─ Better Auth (already in carinaai.uk)         │
│         │   • Email/password + OAuth                      │
│         │   • 2FA TOTP                                    │
│         │   • Session management                          │
│         │   • JWT with short expiry (15min) + refresh     │
│         │                                                 │
│         ├─ WHAT TO ADD:                                   │
│         │   • Brute force protection (lock after 5 fails) │
│         │   • Suspicious login detection (new IP/device)  │
│         │   • Session revocation on password change       │
│         │   • Audit log: every login/logout/signup        │
│         └─────────────────────────────────────────────────│
└──────────────────────────────────────────────────────────┘
```

```python
# core.carinaai.uk/middleware/auth_hardening.py

FAILED_LOGIN_THRESHOLD = 5
LOCKOUT_DURATION = 900  # 15 minutes

def check_brute_force(email: str, ip: str) -> bool:
    """Returns True if login is blocked due to brute force."""
    key = f"bruteforce:{email}:{ip}"
    attempts = redis_client.get(key)
    if attempts and int(attempts) >= FAILED_LOGIN_THRESHOLD:
        ttl = redis_client.ttl(key)
        if ttl > 0:
            return True
    return False

def record_failed_login(email: str, ip: str):
    key = f"bruteforce:{email}:{ip}"
    pipe = redis_client.pipeline()
    pipe.incr(key)
    pipe.expire(key, LOCKOUT_DURATION)
    pipe.execute()

def check_suspicious_login(user_id: str, ip: str, user_agent: str) -> bool:
    """Returns True if login looks suspicious."""
    last_ip = redis_client.get(f"user:{user_id}:last_ip")
    if last_ip and last_ip.decode() != ip:
        # New IP; flag for review
        redis_client.setex(f"suspicious:{user_id}", 3600, json.dumps({
            'previous_ip': last_ip.decode(),
            'new_ip': ip,
            'user_agent': user_agent,
            'timestamp': time.time()
        }))
        return True
    redis_client.set(f"user:{user_id}:last_ip", ip)
    return False
```

### 3. Row-Level Security; Users See Only Their Data

```
┌──────────────────────────────────────────────────────────┐
│              DATABASE; RLS ENFORCEMENT                   │
│                                                          │
│  PostgreSQL Row-Level Security:                          │
│                                                          │
│  CREATE POLICY user_isolation ON workspaces              │
│    USING (owner_id = current_setting('app.user_id')); │
│                                                          │
│  CREATE POLICY tenant_isolation ON agents                │
│    USING (tenant_id = current_setting('app.tenant_id'));│
│                                                          │
│  Application-level middleware:                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Every DB query:                                     │ │
│  │   WHERE owner_id = ?user_id                         │ │
│  │   AND   tenant_id = ?tenant_id                      │ │
│  │                                                     │ │
│  │ User 1 → sees User 1's workspaces ONLY              │ │
│  │ User 2 → sees User 2's workspaces ONLY              │ │
│  │ Admin  → sees all (with audit log)                  │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

```sql
-- database/migrations/0017_row_level_security.sql

-- Enable RLS on all tenant-scoped tables
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Workspace isolation
CREATE POLICY workspace_owner_isolation ON workspaces
    FOR ALL
    USING (owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
    WITH CHECK (owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

-- Agent tenant isolation
CREATE POLICY agent_tenant_isolation ON agents
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- Conversation isolation (through workspace)
CREATE POLICY conversation_workspace_isolation ON conversations
    FOR ALL
    USING (
        workspace_id IN (
            SELECT id FROM workspaces 
            WHERE owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid
        )
    );

-- Admin bypass
CREATE POLICY admin_full_access ON workspaces
    FOR ALL
    USING (NULLIF(current_setting('app.role', true), '') = 'admin');
```

```python
# core.carinaai.uk/middleware/rls_middleware.py
from flask import g, request
import contextlib

@contextlib.contextmanager
def set_rls_context(user_id: str, tenant_id: str, role: str = 'user'):
    """Set PostgreSQL session variables for RLS enforcement."""
    from app import db
    db.session.execute("SET app.user_id = :uid", {'uid': user_id})
    db.session.execute("SET app.tenant_id = :tid", {'tid': tenant_id})
    db.session.execute("SET app.role = :role", {'role': role})
    try:
        yield
    finally:
        db.session.execute("RESET app.user_id")
        db.session.execute("RESET app.tenant_id")
        db.session.execute("RESET app.role")

# Auto-apply from JWT
@app.before_request
def apply_rls_from_token():
    if hasattr(g, 'user_id'):
        from sqlalchemy import text
        db.session.execute(text("SET app.user_id = :uid"), {'uid': g.user_id})
        db.session.execute(text("SET app.tenant_id = :tid"), {'tid': g.tenant_id})
```

### 4. Never Expose Secrets; Server-Side Only

```
┌──────────────────────────────────────────────────────────┐
│              SECRET SCANNER                               │
│                                                          │
│  Frontend (.tsx, .js, .html) → SCAN for:                 │
│    • API keys (sk-..., xai-..., anthropic-...)           │
│    • JWT secrets                                          │
│    • Database URLs                                        │
│    • Stripe keys (sk_live_...)                            │
│    • Any string matching /[a-z]+_[a-zA-Z0-9]{20,}/       │
│                                                          │
│  Server-side ONLY:                                        │
│    • .env files (gitignored, never committed)             │
│    • Vault/Secrets Manager (HashiCorp, Doppler, Infisical)│
│    • Runtime injection via systemd EnvironmentFile        │
│                                                          │
│  CI/CD CHECK:                                             │
│    Pre-commit hook + GitHub Action:                       │
│    → scans all staged files for secrets                   │
│    → BLOCKS commit if any found                           │
│    → Reports file + line number                           │
└──────────────────────────────────────────────────────────┘
```

```bash
#!/bin/bash
# scripts/scan-secrets.sh; Pre-commit hook
# Blocks commits containing API keys or secrets

PATTERNS=(
    'sk-[a-zA-Z0-9]{32,}'           # OpenAI/Stripe
    'xai-[a-zA-Z0-9]{32,}'          # xAI
    'anthropic-[a-zA-Z0-9]{32,}'    # Anthropic
    'sk_live_[a-zA-Z0-9]{24,}'      # Stripe live
    'pk_live_[a-zA-Z0-9]{24,}'      # Stripe publishable (warn only)
    'AIza[0-9A-Za-z\-_]{35}'        # Google API
    'ya29\.[0-9A-Za-z\-_]+'         # Google OAuth
    'github_pat_[a-zA-Z0-9_]{36,}'  # GitHub PAT
    'postgres://[^ ]+@'             # DB URLs
    'mongodb\+srv://[^ ]+@'         # MongoDB URLs
    '-----BEGIN (RSA |EC )?PRIVATE KEY-----'  # Private keys
)

FOUND=0
for pattern in "${PATTERNS[@]}"; do
    matches=$(git diff --cached --name-only | xargs grep -lE "$pattern" 2>/dev/null)
    if [ -n "$matches" ]; then
        echo "Failed:  SECRET FOUND: $pattern"
        echo "$matches" | while read file; do
            echo "   → $file"
            git diff --cached "$file" | grep -nE "$pattern" | head -3
        done
        FOUND=1
    fi
done

if [ $FOUND -eq 1 ]; then
    echo ""
    echo " COMMIT BLOCKED; secrets detected."
    echo "   Move secrets to .env or vault. Never commit them."
    exit 1
fi

echo "Done:  No secrets detected. Commit allowed."
```

### 5. Cache Repeated Requests; Redis Everywhere

```
┌──────────────────────────────────────────────────────────┐
│              CACHE LAYER                                   │
│                                                          │
│  Redis cache for:                                         │
│    • AI responses (TTL: 1hr for same prompt+model)       │
│    • User sessions (TTL: 24hr)                            │
│    • Rate limit counters (TTL: window size)               │
│    • DB query results (TTL: 5min for list endpoints)     │
│    • API responses (TTL: 30s for public endpoints)       │
│                                                          │
│  Cache invalidation:                                      │
│    • On write → invalidate related cache keys             │
│    • Pattern-based: user:{id}:* flushed on user update    │
└──────────────────────────────────────────────────────────┘
```

```python
# core.carinaai.uk/middleware/cache.py
import hashlib, json
from functools import wraps

def cache_response(ttl: int = 300):
    """Cache API responses in Redis."""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            # Build cache key from function + args + user
            cache_parts = [
                f.__name__,
                str(args),
                str(sorted(kwargs.items())),
                g.get('user_id', 'anon'),
            ]
            cache_key = f"cache:{hashlib.md5(':'.join(cache_parts).encode()).hexdigest()}"

            cached = redis_client.get(cache_key)
            if cached:
                return json.loads(cached)

            result = f(*args, **kwargs)
            redis_client.setex(cache_key, ttl, json.dumps(result))
            return result
        return wrapper
    return decorator

def invalidate_user_cache(user_id: str):
    """Invalidate all cached responses for a user."""
    pattern = f"cache:*:{user_id}"
    keys = redis_client.keys(pattern)
    if keys:
        redis_client.delete(*keys)

# Usage
@app.route('/api/workspaces')
@cache_response(ttl=300)  # 5 minute cache
def list_workspaces(): ...

@app.route('/api/workspaces', methods=['POST'])
def create_workspace():
    result = ...
    invalidate_user_cache(g.user_id)  # Invalidate on write
    return result
```

### 6. Async Heavy Tasks; Don't Block the Request

```
┌──────────────────────────────────────────────────────────┐
│              BACKGROUND JOB QUEUE                         │
│                                                          │
│  Move these OFF the request thread:                       │
│                                                          │
│  ┌─────────────────┐     ┌─────────────────────────────┐ │
│  │  HTTP Request    │     │  Redis Queue (RQ / Celery)  │ │
│  │                  │     │                             │ │
│  │  POST /chat      │────→│  AI inference (10-30s)     │ │
│  │  POST /upload    │────→│  PDF parsing                │ │
│  │  POST /send      │────→│  Email sending              │ │
│  │  POST /scan      │────→│  Malware scan (CAPEv2)      │ │
│  │  POST /report    │────→│  Report generation          │ │
│  │  POST /import    │────→│  CSV/Excel processing        │ │
│  │                  │     │                             │ │
│  │  Response:       │     │  Worker picks up →          │ │
│  │  202 Accepted    │     │  processes → stores result  │ │
│  │  {job_id: "..."} │     │  → webhook/SSE notify       │ │
│  └─────────────────┘     └─────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

```python
# core.carinaai.uk/jobs/queue.py
import redis, json, uuid, threading, time
from datetime import datetime

redis_client = redis.Redis(decode_responses=True)
JOB_QUEUE = "carina:jobs"
JOB_RESULTS = "carina:job_results"

def enqueue_job(task_type: str, payload: dict, user_id: str) -> str:
    """Enqueue a background job, return job_id."""
    job_id = str(uuid.uuid4())
    job = {
        'job_id': job_id,
        'task_type': task_type,
        'payload': payload,
        'user_id': user_id,
        'status': 'queued',
        'created_at': datetime.utcnow().isoformat(),
    }
    redis_client.lpush(JOB_QUEUE, json.dumps(job))
    redis_client.setex(f"job:{job_id}", 86400, json.dumps(job))
    return job_id

def get_job_status(job_id: str) -> dict:
    """Check job status."""
    raw = redis_client.get(f"job:{job_id}")
    if raw:
        return json.loads(raw)
    return {'status': 'not_found'}

# Worker
def worker_loop():
    """Process jobs from queue."""
    while True:
        _, raw_job = redis_client.brpop(JOB_QUEUE, timeout=5)
        if not raw_job:
            continue
        job = json.loads(raw_job)
        job['status'] = 'processing'
        redis_client.setex(f"job:{job['job_id']}", 86400, json.dumps(job))
        
        try:
            result = process_job(job)
            job['status'] = 'completed'
            job['result'] = result
        except Exception as e:
            job['status'] = 'failed'
            job['error'] = str(e)
        
        redis_client.setex(f"job:{job['job_id']}", 86400, json.dumps(job))

# SSE endpoint for real-time job status
@app.route('/api/jobs/<job_id>/stream')
def job_stream(job_id):
    def generate():
        last_status = None
        while True:
            status = get_job_status(job_id)
            if status['status'] != last_status:
                yield f"data: {json.dumps(status)}\n\n"
                last_status = status['status']
            if status['status'] in ('completed', 'failed'):
                break
            time.sleep(1)
    return Response(generate(), mimetype='text/event-stream')
```

### 7. Load Test Before Launch; Find the Breaking Point

```
┌──────────────────────────────────────────────────────────┐
│              LOAD TEST SUITE                               │
│                                                          │
│  Tools: k6, locust, or hey                                │
│                                                          │
│  Test scenarios:                                          │
│    • 100 concurrent users → login + chat + dashboard     │
│    • 500 RPM on /api/agent/chat                          │
│    • 1000 RPM on /api/workspaces (GET)                   │
│    • 50 concurrent file uploads                           │
│    • Burst: 200 users in 10 seconds                       │
│    • Sustained: 50 users for 30 minutes                   │
│                                                          │
│  Must pass:                                               │
│    • P95 response < 500ms                                 │
│    • P99 response < 2s                                    │
│    • Error rate < 0.1%                                    │
│    • No OOM kills                                          │
│    • No DB connection pool exhaustion                     │
│    • Rate limiter actually blocks at threshold            │
└──────────────────────────────────────────────────────────┘
```

```javascript
// tests/load/k6-smoke-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    stages: [
        { duration: '30s', target: 20 },   // Ramp up
        { duration: '1m',  target: 100 },  // Peak
        { duration: '30s', target: 0 },    // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<500', 'p(99)<2000'],
        http_req_failed: ['rate<0.001'],
    },
};

const BASE_URL = 'https://app.carinaai.uk';

export default function () {
    // Login
    const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
        email: 'test@carinaai.uk',
        password: 'test-password',
    }), { headers: { 'Content-Type': 'application/json' } });
    
    check(loginRes, { 'login OK': (r) => r.status === 200 });
    const token = loginRes.json('token');

    // List workspaces
    const wsRes = http.get(`${BASE_URL}/api/workspaces`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    check(wsRes, { 'workspaces OK': (r) => r.status === 200 });

    // Chat with agent
    const chatRes = http.post(`${BASE_URL}/api/agent/chat`, JSON.stringify({
        message: 'Hello',
        agent_id: 'test-agent',
    }), { headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json' 
    }});
    check(chatRes, { 'chat OK': (r) => r.status === 200 });

    sleep(1);
}
```

---

## Implementation Order (Priority by Risk)

| Priority | What | Why First |
|----------|------|-----------|
|  P0 | **Secret scanner** + pre-commit hook | One leaked API key = thousands in fraud. Do today. |
|  P0 | **Rate limiting** on login + AI endpoints | First real users will hammer your API. Blocks abuse. |
|  P1 | **Row-level security** on DB | Prevents data leaks between tenants. Regulatory requirement. |
|  P1 | **Async jobs for AI + email** | 30-second AI requests block your web server. Move to queue. |
|  P2 | **Redis caching** | Reduces load, speeds up repeated requests. |
|  P2 | **Brute force protection** | Already have auth; add lockout after 5 failures. |
|  P3 | **Load testing** | Find breaking points before users do. |

---

## Files

| # | Action | File | Purpose |
|---|--------|------|---------|
| 1 | **CREATE** | `core.carinaai.uk/middleware/rate_limiter.py` | Rate limiting on all endpoints |
| 2 | **CREATE** | `core.carinaai.uk/middleware/auth_hardening.py` | Brute force + suspicious login |
| 3 | **CREATE** | `database/migrations/0017_row_level_security.sql` | RLS on all tenant tables |
| 4 | **CREATE** | `core.carinaai.uk/middleware/rls_middleware.py` | Auto-apply RLS from JWT |
| 5 | **CREATE** | `scripts/scan-secrets.sh` | Pre-commit secret scanner |
| 6 | **CREATE** | `.github/workflows/secret-scan.yml` | CI secret scan workflow |
| 7 | **CREATE** | `core.carinaai.uk/middleware/cache.py` | Redis caching layer |
| 8 | **CREATE** | `core.carinaai.uk/jobs/queue.py` | Background job queue |
| 9 | **CREATE** | `tests/load/k6-smoke-test.js` | K6 load test script |
| 10 | **MODIFY** | `core.carinaai.uk/app.py` | Wire middleware + routes |

---

## Acceptance Criteria

- [ ] Secret scanner blocks commits containing API keys, tokens, or DB URLs
- [ ] Rate limiter returns 429 after 5 login attempts/minute; confirmed by load test
- [ ] AI endpoint rate-limited at 30 requests/minute per user
- [ ] Row-level security: User A cannot see User B's workspaces/agents/conversations
- [ ] Admin can see all data (with audit log)
- [ ] Brute force protection: account locked for 15 minutes after 5 failed logins
- [ ] AI inference, email sending, PDF parsing moved to background jobs
- [ ] Background jobs return 202 with job_id; SSE endpoint streams status
- [ ] Redis caches list endpoints for 5 minutes; invalidated on write
- [ ] Load test: 100 concurrent users → P95 < 500ms, error rate < 0.1%
- [ ] Load test: rate limiter actually blocks at threshold
- [ ] No API keys found in any frontend file after hardening

---

## Reference

Source: SWErikCodes; "How to build an app that ACTUALLY works when users start using it"
82K views, 1.9K reactions on Facebook Reels
