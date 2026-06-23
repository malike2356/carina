# Prompt 02: HEALTHCHECK and Graceful Shutdown

**Status: COMPLETED 2026-06-21**

## Context

Docker containers need HEALTHCHECK directives so the orchestrator knows when a service is
actually ready vs. started. Without them, `docker compose up` reports healthy before the
Node.js server has loaded its DB connections and is ready to accept requests.

The carina-core Node.js process also needs to handle SIGTERM gracefully: drain in-flight
requests, close DB pool, then exit. Currently the process receives SIGTERM and exits
immediately, cutting off any active streaming sessions.

## What to Build

### 1. Add HEALTHCHECK to `docker/Dockerfile.carina`

```dockerfile
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
```

The `/health` endpoint already exists at `src/server.ts` - confirm it returns 200 with
`{ status: "ok" }`.

### 2. Add graceful shutdown to `src/server.ts`

Find the existing server startup block and add SIGTERM/SIGINT handlers:

```typescript
const server = app.listen(port, () => {
  console.log(`Carina core listening on :${port}`);
});

function shutdown(signal: string): void {
  console.log(`[shutdown] received ${signal}, draining...`);
  server.close(() => {
    console.log('[shutdown] HTTP server closed');
    pool.end().then(() => {
      console.log('[shutdown] DB pool closed');
      process.exit(0);
    });
  });
  // Force exit after 25s if drain stalls
  setTimeout(() => process.exit(1), 25_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
```

`pool` is the pg.Pool instance from `src/memory/db.ts` - import it.

### 3. Add `/health` endpoint if missing

In `src/server.ts`, ensure there is a simple health route:

```typescript
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: Date.now() });
});
```

This should be before any auth middleware so it is always reachable.

### 4. Log rotation config

Create `docker/logrotate/carina` to prevent log files growing unbounded:

```
/app/data/logs/*.log {
  daily
  rotate 7
  compress
  delaycompress
  missingok
  notifempty
  copytruncate
}
```

Mount this into the container at `/etc/logrotate.d/carina` in `docker-compose.prod.yml`.

## Verification Checklist

- [ ] `docker inspect --format='{{json .State.Health}}' carina-core` shows Status "healthy"
- [ ] Send `docker kill --signal=SIGTERM carina-core-container` - process exits cleanly in <5s, no ECONNRESET in client
- [ ] `/health` returns 200 within 30s of container start
- [ ] Log files in `data/logs/` do not grow past 20MB per file (logrotate)

## Files to Modify

- MODIFY `docker/Dockerfile.carina` - add HEALTHCHECK
- MODIFY `src/server.ts` - add SIGTERM handler and /health if missing
- CREATE `docker/logrotate/carina`
- MODIFY `docker-compose.prod.yml` - mount logrotate config
