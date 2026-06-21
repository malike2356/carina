# Gap 01: Docker Multi-Service Supervision

Agent: Codex (primary), Claude Code (fallback)
Estimated time: 1 day

---

## Context

The Carina mono-repo lives at the git root. All agent code is under
`core.carinaai.uk/`. The Docker build is a multi-stage image defined in
`core.carinaai.uk/docker/Dockerfile.carina`. A supervisor config already
exists for the hub process at
`core.carinaai.uk/docker/supervisor/carina-hub.conf` - use it as your
template for every new config.

The entrypoint is `docker/docker-entrypoint.sh`. It calls
`node /app/dist/src/setup/container-bootstrap.js` then execs whatever CMD
is passed. The Dockerfile currently uses tini as PID 1 and exposes ports
3000 and 3001.

Three supervisor configs are MISSING:
- carina-core (the main agent, `node dist/src/index.js`)
- carina-gateway (HTTP/channel adapter, `node dist/server.js`, depends on
  core being up)
- carina-web (web UI, `node dist/packages/web/dist/web-server.js --port 8080`,
  depends on core being up)

The Dockerfile already has a HEALTHCHECK but it targets the wrong port
(`3000/api/config`). It needs to be updated to check port 3333 at
`/health`. A companion shell script `docker/healthcheck.sh` should be
added to make the check testable outside the image.

---

## Step 1: Read the existing template first

Open and read:

```
core.carinaai.uk/docker/supervisor/carina-hub.conf
core.carinaai.uk/docker/Dockerfile.carina
core.carinaai.uk/docker/docker-entrypoint.sh
```

Note the naming conventions, env var style, log paths, and
`stopwaitsecs` values in carina-hub.conf. Mirror them exactly.

---

## Step 2: Create carina-core.conf

Create `core.carinaai.uk/docker/supervisor/carina-core.conf` with this
exact content (no substitutions required - the VPS operator replaces
CHANGE_ME values at deploy time):

```ini
; Carina Core Agent
; sudo supervisorctl reread && sudo supervisorctl update && sudo supervisorctl start carina-core

[program:carina-core]
command=node /home/malike/apps/core.carinaai.uk/dist/src/index.js
directory=/home/malike/apps/core.carinaai.uk
user=malike
autostart=true
autorestart=true
stopwaitsecs=30
stdout_logfile=/var/log/supervisor/carina-core.out.log
stderr_logfile=/var/log/supervisor/carina-core.err.log
stdout_logfile_maxbytes=10MB
stderr_logfile_maxbytes=10MB
environment=NODE_ENV="production",CARINA_HOME="/home/malike/.carina",CARINA_LOCALES_DIR="/home/malike/apps/core.carinaai.uk/locales",CARINA_GATEWAY_PORT="3333",CARINA_SKIP_CONTAINER_BOOTSTRAP="false"
```

---

## Step 3: Create carina-gateway.conf

Create `core.carinaai.uk/docker/supervisor/carina-gateway.conf`:

```ini
; Carina Gateway (HTTP channel adapter / web entry point)
; Depends on carina-core being up. Start order: carina-core first.
; sudo supervisorctl reread && sudo supervisorctl update && sudo supervisorctl start carina-gateway

[program:carina-gateway]
command=node /home/malike/apps/core.carinaai.uk/dist/server.js
directory=/home/malike/apps/core.carinaai.uk
user=malike
autostart=true
autorestart=true
stopwaitsecs=15
stdout_logfile=/var/log/supervisor/carina-gateway.out.log
stderr_logfile=/var/log/supervisor/carina-gateway.err.log
stdout_logfile_maxbytes=10MB
stderr_logfile_maxbytes=10MB
environment=NODE_ENV="production",CARINA_HOME="/home/malike/.carina",CARINA_GATEWAY_PORT="3333",CARINA_CORE_URL="http://127.0.0.1:3333"
```

---

## Step 4: Create carina-web.conf

Create `core.carinaai.uk/docker/supervisor/carina-web.conf`:

```ini
; Carina Web UI (packages/web static server, port 8080)
; Depends on carina-core being up.
; sudo supervisorctl reread && sudo supervisorctl update && sudo supervisorctl start carina-web

[program:carina-web]
command=node /home/malike/apps/core.carinaai.uk/dist/packages/web/dist/web-server.js --port 8080
directory=/home/malike/apps/core.carinaai.uk
user=malike
autostart=true
autorestart=true
stopwaitsecs=10
stdout_logfile=/var/log/supervisor/carina-web.out.log
stderr_logfile=/var/log/supervisor/carina-web.err.log
stdout_logfile_maxbytes=10MB
stderr_logfile_maxbytes=10MB
environment=NODE_ENV="production",CARINA_CORE_URL="http://127.0.0.1:3333",WEB_PORT="8080"
```

---

## Step 5: Create healthcheck.sh

Create `core.carinaai.uk/docker/healthcheck.sh`:

```sh
#!/bin/sh
# Carina container health check.
# Used by Dockerfile HEALTHCHECK and can be run manually:
#   docker exec <container> /usr/local/bin/healthcheck.sh
set -eu

HOST="${CARINA_HEALTH_HOST:-127.0.0.1}"
PORT="${CARINA_GATEWAY_PORT:-3333}"
TIMEOUT="${CARINA_HEALTH_TIMEOUT:-5}"

wget -q --timeout="${TIMEOUT}" -O- "http://${HOST}:${PORT}/health" > /dev/null 2>&1
```

Make it executable: `chmod +x docker/healthcheck.sh`.

The script must be copied into the image. Add this line to the runtime
stage of Dockerfile.carina, after the existing `docker-entrypoint.sh`
COPY line:

```dockerfile
COPY docker/healthcheck.sh /usr/local/bin/healthcheck.sh
RUN chmod +x /usr/local/bin/healthcheck.sh
```

---

## Step 6: Update the HEALTHCHECK directive in Dockerfile.carina

The current HEALTHCHECK in `core.carinaai.uk/docker/Dockerfile.carina`
is:

```dockerfile
HEALTHCHECK --interval=15s --timeout=5s --start-period=45s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/api/config || exit 1
```

Replace it with:

```dockerfile
HEALTHCHECK --interval=15s --timeout=5s --start-period=45s --retries=5 \
  CMD /usr/local/bin/healthcheck.sh || exit 1
```

Do not change any other line in the Dockerfile.

---

## Step 7: Group start ordering note

Supervisor does not have a built-in `depends_on`. Ordering is achieved
by priority. Add a group config at
`core.carinaai.uk/docker/supervisor/carina-group.conf`:

```ini
; Launch order: carina-core must start before gateway and web.
; Use priority to approximate dependency ordering.

[program:carina-core]
priority=10

[program:carina-gateway]
priority=20

[program:carina-web]
priority=30

[program:carina-hub]
priority=20
```

Note: supervisor reads priority from the individual conf files. This
group file documents the ordering but you still need to set
`priority=10` in carina-core.conf, `priority=20` in carina-gateway.conf
and carina-hub.conf, and `priority=30` in carina-web.conf. Add the
`priority=` line to each file you created in Steps 2-4, and also add
`priority=20` to the existing carina-hub.conf.

---

## Files to create or modify

| File | Action |
|---|---|
| `core.carinaai.uk/docker/supervisor/carina-core.conf` | CREATE |
| `core.carinaai.uk/docker/supervisor/carina-gateway.conf` | CREATE |
| `core.carinaai.uk/docker/supervisor/carina-web.conf` | CREATE |
| `core.carinaai.uk/docker/supervisor/carina-group.conf` | CREATE |
| `core.carinaai.uk/docker/healthcheck.sh` | CREATE |
| `core.carinaai.uk/docker/Dockerfile.carina` | MODIFY (HEALTHCHECK + COPY healthcheck.sh) |
| `core.carinaai.uk/docker/supervisor/carina-hub.conf` | MODIFY (add priority=20) |

---

## Done-when criteria

- [ ] `docker/supervisor/` contains carina-core.conf, carina-gateway.conf,
  carina-web.conf, carina-hub.conf, carina-group.conf
- [ ] Each conf file has `priority=` set (10/20/20/30 as above)
- [ ] `docker/healthcheck.sh` exists and is executable
- [ ] `Dockerfile.carina` HEALTHCHECK directive calls `/usr/local/bin/healthcheck.sh`
- [ ] `Dockerfile.carina` has COPY and chmod for healthcheck.sh
- [ ] Running `docker build -f docker/Dockerfile.carina .` from
  `core.carinaai.uk/` completes without error
- [ ] No other files were modified

---

## Do NOT do

- Do not change docker-compose files
- Do not change `docker-entrypoint.sh`
- Do not install supervisord into the Dockerfile (it is used on the VPS
  host, not inside the container)
- Do not change port numbers or add new EXPOSE directives
