# Prompt 01: Supervisor Configs for Core and Gateway

## Context

`docker/supervisor/carina-hub.conf` exists and works for the Skills Hub process.
The same pattern needs to be applied to `carina-core` (the main agent server on port 3000)
and any long-lived gateway processes.

The current prod container uses `start.sh` which runs processes manually. Under load or
crash, there is no automatic restart and no process isolation between services.

## Existing Files to Reference

- `core.carinaai.uk/docker/supervisor/carina-hub.conf` - copy this pattern
- `core.carinaai.uk/start.sh` - current entrypoint, lists what processes run
- `core.carinaai.uk/docker/Dockerfile.carina` - the container definition

## What to Build

### 1. `docker/supervisor/carina-core.conf`

```ini
[program:carina-core]
command=node /app/dist/src/server.js
directory=/app
autostart=true
autorestart=true
startretries=5
startsecs=3
stopwaitsecs=30
stdout_logfile=/app/data/logs/carina-core.log
stdout_logfile_maxbytes=20MB
stdout_logfile_backups=5
stderr_logfile=/app/data/logs/carina-core-err.log
stderr_logfile_maxbytes=10MB
stderr_logfile_backups=3
environment=NODE_ENV="production"
user=node
```

### 2. `docker/supervisor/carina-ops.conf`

```ini
[program:carina-ops]
command=node /app/ops.carinaai.uk/dist/server.js
directory=/app/ops.carinaai.uk
autostart=true
autorestart=true
startretries=3
startsecs=5
stopwaitsecs=20
stdout_logfile=/app/data/logs/carina-ops.log
stdout_logfile_maxbytes=10MB
stdout_logfile_backups=3
stderr_logfile=/app/data/logs/carina-ops-err.log
stderr_logfile_maxbytes=5MB
stderr_logfile_backups=2
environment=NODE_ENV="production"
user=node
```

### 3. `docker/supervisor/supervisord.conf` (root config)

```ini
[supervisord]
nodaemon=true
logfile=/app/data/logs/supervisord.log
logfile_maxbytes=5MB
logfile_backups=2
loglevel=info
pidfile=/var/run/supervisord.pid

[unix_http_server]
file=/var/run/supervisor.sock
chmod=0700

[rpcinterface:supervisor]
supervisor.rpcinterface_factory=supervisor.rpcinterface:make_main_rpcinterface

[supervisorctl]
serverurl=unix:///var/run/supervisor.sock

[include]
files=/app/docker/supervisor/*.conf
```

### 4. Update `Dockerfile.carina`

Replace the final CMD with supervisord:

```dockerfile
RUN pip3 install supervisor --break-system-packages 2>/dev/null || pip3 install supervisor

CMD ["/usr/local/bin/supervisord", "-c", "/app/docker/supervisor/supervisord.conf"]
```

Remove the direct `node` CMD and `start.sh` entrypoint. The supervisor configs start all services.

### 5. Update `docker-compose.prod.yml`

Remove any explicit `command:` override on the carina-core service since supervisord now handles it.

## Verification Checklist

- [ ] `docker compose -f docker-compose.prod.yml up -d carina` starts and supervisor shows all processes running
- [ ] Kill carina-core process manually: `supervisorctl kill carina-core` - it restarts within 3 seconds
- [ ] Logs appear in `data/logs/carina-core.log` inside container
- [ ] `docker exec carina-core supervisorctl status` shows all processes RUNNING

## Files to Create or Modify

- CREATE `docker/supervisor/supervisord.conf`
- CREATE `docker/supervisor/carina-core.conf`
- CREATE `docker/supervisor/carina-ops.conf`
- MODIFY `docker/Dockerfile.carina` - replace CMD
- MODIFY `docker-compose.prod.yml` - remove redundant command
