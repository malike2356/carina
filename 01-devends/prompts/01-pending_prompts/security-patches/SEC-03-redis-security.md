# SEC-03: Redis Security Hardening

**Severity:** High
**Status:** Unpatched - Redis likely running without authentication
**Affects:** core.carinaai.uk (kill switch, sessions, cache), Scout console (events)

## Problem

Redis is used for the kill switch (Redis pub/sub on `labyrinth:control`), session
caching, and potentially queue state. By default Redis has no authentication.
On a shared server or container network, any process that can reach the Redis
port (6379) can read all sessions, trigger the kill switch, and corrupt cache data.

From the supply chain pinning policy: `ioredis` is pinned. That confirms ioredis
is the client. ioredis supports AUTH and TLS natively.

## Files to Patch

```
docker-compose.yml                                    (dev)
docker-compose.prod.yml                               (prod)
.env.production.example                               (env template)
02-backends/core.carinaai.uk/src/config/index.ts     (or wherever Redis client is instantiated)
```

Find Redis client instantiation:
```bash
grep -rn "new Redis\|createClient\|ioredis" 02-backends/core.carinaai.uk/src/ | grep -v ".test." | head -20
```

## Change 1: docker-compose.yml - Add Redis AUTH and Bind Restriction

Find the redis service block in `docker-compose.yml` and replace:

```yaml
# BEFORE (typical default):
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
```

```yaml
# AFTER:
redis:
  image: redis:7-alpine
  command: >
    redis-server
    --requirepass ${REDIS_PASSWORD}
    --bind 127.0.0.1 redis
    --protected-mode yes
    --rename-command FLUSHALL ""
    --rename-command FLUSHDB ""
    --rename-command CONFIG "CONFIG_DISABLED_USE_ENV"
    --rename-command DEBUG ""
    --rename-command SHUTDOWN ""
    --loglevel warning
    --maxmemory 512mb
    --maxmemory-policy allkeys-lru
  environment:
    - REDIS_PASSWORD=${REDIS_PASSWORD}
  # Do NOT expose port 6379 externally in prod.
  # Remove the ports: block or use 127.0.0.1:6379:6379 for local dev only.
  volumes:
    - redis_data:/data
  healthcheck:
    test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
    interval: 10s
    timeout: 5s
    retries: 3
```

Apply the same change to `docker-compose.prod.yml`.

## Change 2: .env.production.example - Add REDIS_PASSWORD

Add to the Redis section:
```bash
# Redis - REQUIRED in production. Use a random 32+ character string.
# Generate with: openssl rand -base64 32
REDIS_PASSWORD=change_this_to_a_random_32_char_string

# Redis URL (used by the Node.js app - include password)
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
```

## Change 3: Node.js Redis Client - Add AUTH

Find where ioredis is instantiated (likely in config or a redis.ts helper).
Example change:

```typescript
// BEFORE:
import Redis from 'ioredis';
const redis = new Redis({ host: 'redis', port: 6379 });

// AFTER:
import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL ?? 'redis://redis:6379';
const redis = new Redis(redisUrl, {
  // Reconnect strategy: exponential backoff, max 30s
  retryStrategy: (times: number) => Math.min(times * 100, 30_000),
  enableReadyCheck: true,
  // TLS if REDIS_TLS=true
  ...(process.env.REDIS_TLS === 'true' ? {
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  } : {}),
});

redis.on('error', (err) => {
  console.error('[redis] connection error:', err.message);
});
```

If Redis is instantiated in multiple places, refactor to a single
`src/lib/redis.ts` that exports the singleton and is imported everywhere.

## Change 4: kill-switch-listener.ts - Verify AUTH is Inherited

Open `02-backends/core.carinaai.uk/src/security/kill-switch-listener.ts` and
confirm the Redis client it uses comes from the centralized singleton, not a
separate `new Redis()` call without auth. If it creates its own client, replace
with the singleton.

## Change 5: Redis ACL (Production Only)

After applying the above, create an ACL config for the production Redis instance
that limits the Carina process to only the commands it needs:

```redis
# /etc/redis/users.acl
# Default user - disabled
user default off nopass ~* &* -@all

# Carina app user
user carina on >${REDIS_PASSWORD} ~carina:* ~labyrinth:* ~session:* ~cache:* &labyrinth:control +GET +SET +DEL +EXPIRE +TTL +EXISTS +LPUSH +RPOP +PUBLISH +SUBSCRIBE +UNSUBSCRIBE +PING +INFO
```

Add to redis command in docker-compose.prod.yml:
```yaml
command: redis-server --aclfile /etc/redis/users.acl ...
```

## Verification

```bash
# Verify Redis rejects unauthenticated connections
redis-cli -h localhost ping
# Must return: (error) NOAUTH Authentication required

# Verify authenticated connection works
redis-cli -h localhost -a "$REDIS_PASSWORD" ping
# Must return: PONG

# Verify FLUSHALL is disabled
redis-cli -h localhost -a "$REDIS_PASSWORD" FLUSHALL
# Must return: (error) ERR unknown command 'FLUSHALL'

# Verify kill switch still works end-to-end
# From the ops panel: trigger a kill switch for a test session
# Verify it propagates within 2 seconds
```

## Deployment Notes

- Change REDIS_PASSWORD in `.env` on the VPS before deploying. The docker compose
  uses environment variable substitution so the password never appears in the
  compose file itself.
- After adding auth, all existing cached data becomes inaccessible but not lost.
  Sessions will force re-auth on next user request. This is expected.
- Do NOT deploy this during peak hours. Schedule for a maintenance window.
- Do NOT use the VPS to set `REDIS_PASSWORD`. Set it in `.env` locally, commit
  the docker-compose change, and deploy via `bash deploy.sh`.
