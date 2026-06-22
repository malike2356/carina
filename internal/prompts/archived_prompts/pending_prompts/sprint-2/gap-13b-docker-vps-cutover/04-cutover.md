# Gap 13 - Prompt 04: Cutover - Stop Bare Metal, Start Docker Stacks

**Status: COMPLETED 2026-06-21**

**Gap:** 13 Docker Migration
**Prompt number:** 04 of 05
**Name:** Cutover - Traffic Switchover from Bare Metal Nginx to Docker Nginx
**Primary agent:** Claude Code
**Estimated hours:** 2-3 h (includes wait time for builds and health checks)
**Depends on:** Prompts 01, 02, 03 all completed and committed to git

**WARNING: This prompt causes a brief service interruption during nginx switchover.
Run it in a maintenance window. Target downtime: under 5 minutes if steps are followed
in order. Services already down (carina-cloud, carina-hub, app.carinaai.uk) have no
additional risk.**

---

## Post-build (MANDATORY)

What was built:
- Docker cutover from bare-metal nginx to the Docker stack for Carina traffic
- Live VPS restart flow for the core service boundary
- Verified public endpoints now route without the old bare-metal path

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Pre-flight checklist (confirm before running ANY commands)

- [ ] Prompt 01 committed: nginx Docker configs written, SSL mount path updated in compose
- [ ] Prompt 02 committed and changes pulled on VPS: hub db fix, build context vars set
- [ ] Prompt 03 committed and changes pulled on VPS: scout prod compose written
- [ ] `.env.runtime` on VPS has `CARINA_OPS_CONTEXT` and `CARINA_CLOUD_CONTEXT` set
- [ ] Scout `.env` file exists on VPS at `console.labyrinthscout.com/.env`
- [ ] VPS has enough disk: `df -h` - need at least 3 GB free for Docker images

---

## Step 0: Create the proxy Docker network

```bash
ssh malike@80.190.81.208
docker network create proxy
```

If it already exists, this command errors safely: "network with name proxy already exists".
That is fine.

---

## Step 1: Pull latest code on VPS

```bash
cd /home/malike/apps/core.carinaai.uk
git pull

cd /home/malike/apps/console.labyrinthscout.com
git pull

cd /home/malike/apps/scout-engine
git pull

cd /home/malike/apps/ops.carinaai.uk
git pull

cd /home/malike/apps/app.carinaai.uk
git pull
```

---

## Step 2: Build Docker images (do this BEFORE stopping anything)

Building can take 5-10 minutes. Do it while bare-metal nginx is still serving traffic.

```bash
cd /home/malike/apps/core.carinaai.uk

# Build all Carina services
docker compose -f docker-compose.prod.yml build --no-cache

# Check for build errors
echo "Exit code: $?"
```

```bash
cd /home/malike/apps/console.labyrinthscout.com

# Build Scout services
docker compose -f docker-compose.prod.yml build --no-cache

echo "Exit code: $?"
```

If either build fails, stop here. Fix the build issue and re-run before proceeding.

---

## Step 3: Bring up Scout stack (no nginx conflict yet - Scout uses proxy network)

Scout services do not bind to port 80 or 443. Starting them now causes no conflict
with bare-metal nginx.

```bash
cd /home/malike/apps/console.labyrinthscout.com
docker compose -f docker-compose.prod.yml up -d

# Wait for healthy
sleep 15
docker compose -f docker-compose.prod.yml ps
```

Expected output: postgres and redis healthy, labyrinth-scout and scout-engine running.

If labyrinth-scout fails to start, check logs:
```bash
docker compose -f docker-compose.prod.yml logs labyrinth-scout --tail 30
```

Do not proceed to Step 4 until labyrinth-scout is healthy.

---

## Step 4: Bring up Carina stack WITHOUT nginx service

Start all Carina services except nginx. This lets us verify they start before we cut
over the traffic.

```bash
cd /home/malike/apps/core.carinaai.uk

# Start everything except nginx
docker compose -f docker-compose.prod.yml up -d \
  carina-web carina-hub carina-ops carina-cloud postgres redis

sleep 20
docker compose -f docker-compose.prod.yml ps
```

Check each service is healthy:
```bash
docker compose -f docker-compose.prod.yml logs carina-hub --tail 20
docker compose -f docker-compose.prod.yml logs carina-ops --tail 20
docker compose -f docker-compose.prod.yml logs carina-cloud --tail 20
```

If carina-hub is still crash-looping, check Prompt 02 Step 1 (database fix). Do not
proceed until it is stable.

---

## Step 5: Cutover - the brief outage window

The following commands will cause a short outage. Run them in rapid succession.

```bash
# 5a. Stop bare-metal nginx
sudo systemctl stop nginx

# 5b. Stop supervisor processes that will now be replaced by Docker
#     (NOT propreneur-horizon or propreneur-scheduler)
sudo supervisorctl stop carina-cloud carina-core carina-hub carina-ops labyrinth-scout scout-engine nginx-reload

# 5c. Start Docker nginx (binds to port 80 and 443)
cd /home/malike/apps/core.carinaai.uk
docker compose -f docker-compose.prod.yml up -d nginx

# 5d. Verify nginx started and port 443 is bound
sleep 5
docker compose -f docker-compose.prod.yml ps nginx
ss -tlnp | grep -E ':80|:443'
```

If `docker compose up -d nginx` fails (port already in use), the nginx systemctl stop
did not fully release the port. Try:
```bash
sudo systemctl stop nginx && sudo pkill nginx
sleep 3
docker compose -f docker-compose.prod.yml up -d nginx
```

---

## Step 6: Verify all domains respond

Test each domain from outside the VPS (use curl from your local machine) or from
the VPS itself targeting localhost with a Host header:

```bash
# From VPS - test that Docker nginx is routing correctly
curl -sk -H "Host: core.carinaai.uk" https://127.0.0.1/api/health | head -5
curl -sk -H "Host: hub.carinaai.uk" https://127.0.0.1/api/health | head -5
curl -sk -H "Host: ops.carinaai.uk" https://127.0.0.1/health | head -5
curl -sk -H "Host: console.labyrinthscout.com" https://127.0.0.1/ | head -5
```

Also check app.carinaai.uk:
```bash
curl -sk -H "Host: app.carinaai.uk" https://127.0.0.1/ | head -10
```

Expected: HTTP 200 responses or redirects to login. Not connection refused or 502.

---

## Step 7: Remove host port bindings from Carina services

NOTE: This step is already done. The `docker-compose.prod.yml` in the repo already uses
`expose:` (not `ports:`) for all Carina app services. Only the nginx service publishes
host ports 80 and 443. No file edits needed.

Re-run the curl health checks from Step 6 to confirm everything responds via nginx.

---

## Step 8: Disable bare-metal nginx from autostarting

```bash
sudo systemctl disable nginx
```

This prevents bare-metal nginx from starting on reboot and conflicting with Docker nginx.
The config files in `/etc/nginx/` can remain for reference until Prompt 05 cleans them.

---

## Step 9: Disable supervisor processes for migrated services

Prevent the migrated supervisor processes from autostarting on reboot:

```bash
# Disable by setting autostart=false in the conf files
# Do NOT delete the conf files yet - that is Prompt 05
sudo sed -i 's/autostart=true/autostart=false/' /etc/supervisor/conf.d/carina-cloud.conf
sudo sed -i 's/autostart=true/autostart=false/' /etc/supervisor/conf.d/carina-core.conf
sudo sed -i 's/autostart=true/autostart=false/' /etc/supervisor/conf.d/carina-hub.conf
sudo sed -i 's/autostart=true/autostart=false/' /etc/supervisor/conf.d/carina-ops.conf
sudo sed -i 's/autostart=true/autostart=false/' /etc/supervisor/conf.d/labyrinth-scout.conf
sudo sed -i 's/autostart=true/autostart=false/' /etc/supervisor/conf.d/scout-engine.conf
sudo sed -i 's/autostart=true/autostart=false/' /etc/supervisor/conf.d/nginx-reload.conf
sudo supervisorctl reread && sudo supervisorctl update
```

---

## Rollback plan (if Step 5 goes wrong)

If Docker nginx fails to start and service is down:

```bash
# Start bare-metal nginx again immediately
sudo systemctl start nginx

# Stop the failed Docker nginx attempt
cd /home/malike/apps/core.carinaai.uk
docker compose -f docker-compose.prod.yml stop nginx

# Re-enable supervisor processes
sudo supervisorctl start carina-core carina-ops labyrinth-scout scout-engine
```

Then diagnose what went wrong before attempting again.

---

## Verification checklist

- [ ] `docker compose -f docker-compose.prod.yml ps` shows all services healthy
- [ ] `curl https://core.carinaai.uk/api/health` returns 200
- [ ] `curl https://app.carinaai.uk` returns 200 or 302
- [ ] `curl https://console.labyrinthscout.com` returns 200
- [ ] `sudo systemctl status nginx` shows disabled/stopped
- [ ] `ss -tlnp | grep :80` shows Docker process (not nginx system process) on port 80
- [ ] Propreneur supervisor processes still running (not stopped by mistake)
