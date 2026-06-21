# Gap 14 - Prompt 02: Server Bootstrap Script

**Status: COMPLETED 2026-06-21**

**Gap:** 14 Deploy Pipeline
**Prompt number:** 02 of 03
**Name:** One-script new-server setup (any VPS or AWS EC2)
**Primary agent:** Claude Code
**Estimated hours:** 1-2 h
**Depends on:** gap-13-docker-migration completed; docker/DEPLOY.md written

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Context

Moving Carina + Scout to a different server currently requires:
1. Manually install Docker
2. Manually create the proxy network
3. Manually install certbot and run it for 6+ domains
4. Clone or rsync repos
5. Copy .env files
6. Start stacks

There is no script that automates steps 1-4. Steps 5-6 are intentionally manual (secrets stay
off CI). The goal is a `scripts/bootstrap-server.sh` that covers steps 1-4 so a new server
is ready to receive a deploy within 5 minutes of provisioning.

---

## Target: What `scripts/bootstrap-server.sh` must do

1. Detect the OS (Ubuntu 22.04 and 24.04 supported; abort on anything else)
2. Install Docker Engine + Compose plugin via the official Docker apt repo
3. Install certbot via snap
4. Install rsync, curl, jq, python3 (deploy dependencies)
5. Create the shared `proxy` Docker network (idempotent)
6. Create the app directories: `/home/malike/apps/{core.carinaai.uk,ops.carinaai.uk,app.carinaai.uk,console.labyrinthscout.com,scout-engine}`
7. Print the next steps the operator must do manually:
   - Copy .env files
   - Run certbot for each domain
   - Run `docker network create proxy` (already done by the script, just remind)
   - Run the deploy

The script must NOT attempt to clone repos or copy secrets. Those stay manual.

---

## Step 1: Create `scripts/bootstrap-server.sh`

```bash
#!/usr/bin/env bash
# Bootstrap a new server for Carina + Labyrinth Scout Docker deployment.
# Tested on Ubuntu 22.04 LTS and Ubuntu 24.04 LTS.
# Run as root or with sudo: bash scripts/bootstrap-server.sh

set -euo pipefail

APPS_DIR="${APPS_DIR:-/home/malike/apps}"
APPS_USER="${APPS_USER:-malike}"

log() { echo "[bootstrap] $*"; }
fail() { echo "[bootstrap] ERROR: $*" >&2; exit 1; }

# Detect OS
. /etc/os-release 2>/dev/null || fail "Cannot read /etc/os-release"
if [[ "$ID" != "ubuntu" ]]; then
  fail "This script requires Ubuntu. Detected: $ID $VERSION_ID"
fi
log "OS: Ubuntu $VERSION_ID"

# Install Docker Engine
if ! command -v docker &>/dev/null; then
  log "Installing Docker..."
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg lsb-release
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > \
    /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  log "Docker installed."
else
  log "Docker already installed: $(docker --version)"
fi

# Add APPS_USER to docker group so they can run docker without sudo
if id "$APPS_USER" &>/dev/null; then
  usermod -aG docker "$APPS_USER"
  log "Added $APPS_USER to docker group."
fi

# Install certbot via snap
if ! command -v certbot &>/dev/null; then
  log "Installing certbot..."
  apt-get install -y -qq snapd
  snap install core && snap refresh core
  snap install --classic certbot
  ln -sf /snap/bin/certbot /usr/bin/certbot
  log "certbot installed."
else
  log "certbot already installed."
fi

# Install utility dependencies
apt-get install -y -qq rsync curl jq python3

# Create shared proxy Docker network (idempotent)
docker network inspect proxy >/dev/null 2>&1 || docker network create proxy
log "proxy Docker network ready."

# Create app directories
mkdir -p \
  "${APPS_DIR}/core.carinaai.uk" \
  "${APPS_DIR}/ops.carinaai.uk" \
  "${APPS_DIR}/app.carinaai.uk" \
  "${APPS_DIR}/console.labyrinthscout.com" \
  "${APPS_DIR}/scout-engine"

if id "$APPS_USER" &>/dev/null; then
  chown -R "${APPS_USER}:${APPS_USER}" "${APPS_DIR}"
fi
log "App directories created at ${APPS_DIR}."

# Create SSL directory
mkdir -p /etc/carina/ssl
log "SSL directory ready at /etc/carina/ssl."

echo ""
echo "========================================="
echo "Bootstrap complete. Manual steps required:"
echo "========================================="
echo ""
echo "1. Issue TLS certificates:"
echo "   certbot certonly --standalone -d carinaai.uk -d www.carinaai.uk \\"
echo "     -d app.carinaai.uk -d core.carinaai.uk -d hub.carinaai.uk \\"
echo "     -d ops.carinaai.uk -d docs.carinaai.uk -d install.carinaai.uk"
echo "   certbot certonly --standalone -d labyrinthscout.com -d www.labyrinthscout.com \\"
echo "     -d console.labyrinthscout.com"
echo ""
echo "   Then link or copy certs to /etc/carina/ssl/:"
echo "   ln -s /etc/letsencrypt /etc/carina/ssl"
echo "   (Or set CARINA_SSL_DIR=/etc/letsencrypt in your .env)"
echo ""
echo "2. Copy .env files to the server:"
echo "   scp .env.docker.runtime malike@SERVER:${APPS_DIR}/core.carinaai.uk/"
echo "   scp ops.env             malike@SERVER:${APPS_DIR}/ops.carinaai.uk/.env"
echo "   scp cloud.env           malike@SERVER:${APPS_DIR}/app.carinaai.uk/.env"
echo "   scp scout.env           malike@SERVER:${APPS_DIR}/console.labyrinthscout.com/.env"
echo ""
echo "3. Trigger the first deploy:"
echo "   bash scripts/deploy-carina.sh"
echo "   (Or push to main to trigger GitHub Actions deploy.yml)"
echo ""
echo "4. Verify all domains respond:"
echo "   curl -fsS https://core.carinaai.uk/api/health"
echo "   curl -fsS https://console.labyrinthscout.com/api/health"
```

---

## Step 2: Create `scripts/bootstrap-aws-ec2.md`

This is not a script; it is a runbook for the AWS EC2 path. Create it at
`scripts/bootstrap-aws-ec2.md`:

```markdown
# Deploying Carina on AWS EC2

This is the simplest AWS path. No ECS, no Fargate, no complex managed services.
The Docker Compose stacks run identically to the Contabo VPS. Moving to AWS costs
more per month but gives better uptime SLAs and the ability to snapshot and restore.

## Recommended EC2 spec

| Config | Minimum | Recommended |
|--------|---------|-------------|
| Instance type | t3.medium (2 vCPU, 4 GB) | t3.large (2 vCPU, 8 GB) |
| OS | Ubuntu 24.04 LTS (AMI: search "ubuntu-noble-24.04-amd64") | same |
| Storage | 30 GB gp3 | 60 GB gp3 |
| Region | eu-west-1 (Ireland - close to UK) | same |

## Security Group rules

| Port | Source | Purpose |
|------|--------|---------|
| 22 | Your IP only | SSH admin access |
| 80 | 0.0.0.0/0 | HTTP (nginx redirects to HTTPS) |
| 443 | 0.0.0.0/0 | HTTPS (Docker nginx) |

Do NOT open Docker daemon port (2375/2376) to the internet.

## Setup procedure

1. Launch EC2 instance (Ubuntu 24.04 LTS AMI, t3.large, 60 GB gp3)
2. Allocate an Elastic IP and associate it with the instance
3. Update DNS: point carinaai.uk and labyrinthscout.com wildcards to the Elastic IP
4. SSH in: ssh -i your-key.pem ubuntu@<ELASTIC_IP>
5. Change the default user if desired: adduser malike; usermod -aG sudo malike
6. Run the bootstrap script: sudo bash scripts/bootstrap-server.sh
7. Issue certs, copy .env files, run deploy (same as VPS; see bootstrap output)

## Data persistence

Postgres data: Docker named volume pgdata (on EC2 instance storage)
Before decommissioning an instance, back up volumes:
  docker run --rm -v corecarinaaiuk_pgdata:/data -v /backup:/backup alpine \
    tar czf /backup/pgdata-$(date +%Y%m%d).tar.gz -C /data .

Restore on new instance:
  docker run --rm -v corecarinaaiuk_pgdata:/data -v /backup:/backup alpine \
    tar xzf /backup/pgdata-20260101.tar.gz -C /data

## Cost estimate (eu-west-1, June 2026)

| Item | Monthly |
|------|---------|
| t3.large (reserved 1yr) | ~$50 |
| 60 GB gp3 EBS | ~$5 |
| Elastic IP (attached) | free |
| Data transfer (10 GB/mo) | ~$1 |
| Total | ~$56/mo |

Contabo VPS comparison: ~$14/mo for similar specs. AWS costs more but has:
- Better uptime SLAs (99.99%)
- Snapshot-based AMI backups (instant server restore)
- VPC network isolation
- Native CloudWatch monitoring
- Easy vertical scaling (resize instance type)

## Optional: ECS Fargate (advanced)

Only consider ECS Fargate if you need:
- Auto-scaling based on CPU/memory
- Zero-downtime blue/green deploys
- Native AWS managed container scheduling

ECS requires:
- ECR (Elastic Container Registry) to push images
- ECS task definitions (replaces docker-compose.prod.yml)
- ALB (Application Load Balancer) to replace Dockerised nginx and handle SSL via ACM
- RDS PostgreSQL and ElastiCache Redis to replace containerised databases
- Estimated cost: $150-300/mo (ALB ~$20, RDS ~$80, Fargate ~$60, ElastiCache ~$40)

Verdict: ECS is overkill until you have enough traffic to need auto-scaling.
EC2 + Docker Compose handles 10,000 monthly active users comfortably on a t3.large.
```

---

## Verification checklist

- [ ] `scripts/bootstrap-server.sh` created and tested on a fresh Ubuntu 24.04 instance
- [ ] Script is idempotent (running twice does not break anything)
- [ ] `scripts/bootstrap-aws-ec2.md` created with accurate EC2 specs and cost estimate
- [ ] Bootstrap output includes complete manual next-steps
- [ ] First deploy after bootstrap completes successfully
