**Status: COMPLETED 2026-06-21**


# Gap 30 - Prompt 02: Sandbox & Gateway Security Docs

**Gap:** 30 Documentation: Model Providers, Sandbox & Security
**Prompt number:** 02 of 02
**Name:** Write sandbox-isolation.md and gateway-hardening.md
**Primary agent:** Claude Code (docs writing)
**Estimated hours:** 2 h
**Depends on:** Nothing

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Read first

1. `internal/servers/core.carinaai.uk/src/security/sandbox/` -- sandbox code
2. `internal/servers/core.carinaai.uk/src/security/kill-switch-listener.ts` -- security controls
3. `internal/servers/core.carinaai.uk/src/security/rasp/` -- RASP engine

---

## Goal

### 1. `docs/user/security/sandbox-isolation.md`

```markdown
# Sandbox Isolation

## Overview
Sandboxing isolates agent tool calls (exec, file operations, browser)
from your host system. This protects against prompt injection attacks
that attempt filesystem or network access.

## Sandbox Modes

| Mode | Isolation Level | Use Case |
|------|----------------|----------|
| `off` | None | Personal use, trusted environment |
| `docker` | Container | Multi-user deployments |
| `ssh` | Remote host | Dedicated execution server |
| `openshell` | Process-level | Lightweight isolation |

## Docker Sandbox

### Setup

```bash
# Enable Docker sandbox
carina sandbox mode docker

# Configure
carina sandbox config docker \
  --image "carina-sandbox:latest" \
  --memory 512m \
  --cpus 1.0 \
  --network none \
  --workspace readonly

# Build the sandbox image
docker build -t carina-sandbox:latest -f docker/Dockerfile.sandbox .
```

### How it works
1. On session start, Carina creates a Docker container
2. Workspace mounted read-only or read-write (configurable)
3. All tool calls (`exec`, `file_read`, `file_write`, `browser`) run inside
4. Network access controlled (none, bridge, or host)
5. Container destroyed on session end

### Per-Agent Sandboxing

```yaml
agents:
  - id: default
    sandbox: off             # primary agent runs un-sandboxed

  - id: code-reviewer
    sandbox:
      mode: docker
      scope: session
      workspaceAccess: readonly
      docker:
        networkMode: none
```

## SSH Sandbox

Route tool calls to a remote execution server:

```bash
carina sandbox mode ssh
carina sandbox config ssh \
  --host sandbox.internal \
  --user carina \
  --key ~/.ssh/carina_sandbox_ed25519 \
  --workdir /tmp/carina-sandbox
```

All exec and file operations proxy through SSH. The remote host
needs no Carina installation -- just a Unix shell.

## OpenShell Sandbox

Lightweight isolation without containers:

```bash
carina sandbox mode openshell
carina sandbox config openshell \
  --allowed-paths "/tmp,/var/tmp" \
  --network false
```

Uses child processes with restricted environment variables
and path allowlisting.

## Sandbox vs Tool Policy vs Scout

Three layers work together:

```
Layer 1: Tool Policy     → Which tools can this agent call?
Layer 2: Sandbox         → Where do tool calls execute?
Layer 3: Scout (Labyrinth) → Real-time threat detection and response
```

## Where to find it in source
- `security/sandbox/` -- sandbox implementations
- `security/kill-switch-listener.ts` -- runtime sandbox policy
- `docker/Dockerfile.sandbox` -- sandbox container image
```

### 2. `docs/user/security/gateway-hardening.md`

```markdown
# Gateway Security Hardening

## Overview
The Gateway is Carina's control plane. Secure it properly before
exposing it to any network.

## Authentication

### Gateway Token
All connections to the Gateway require authentication:

```bash
# Set a strong token
export CARINA_GATEWAY_TOKEN=$(openssl rand -hex 32)

# Or use password auth
export CARINA_GATEWAY_PASSWORD="your-strong-password"
```

### Trusted Proxy Mode
When behind a reverse proxy (nginx, Caddy, Traefik), use trusted proxy mode:

```bash
export CARINA_GATEWAY_AUTH_MODE="trusted-proxy"
export CARINA_TRUSTED_PROXIES="127.0.0.1,10.0.0.0/8"
```

The reverse proxy handles authentication; the Gateway trusts
the `X-Forwarded-User` header.

## Network Exposure

### Local Only (Default)
The Gateway binds to loopback by default:

```bash
carina gateway start --bind 127.0.0.1
```

### Behind Reverse Proxy
```
Internet → nginx (TLS) → localhost:3333 (Gateway)
```

nginx config:

```nginx
server {
    listen 443 ssl;
    server_name carina.example.com;

    ssl_certificate /etc/ssl/certs/carina.pem;
    ssl_certificate_key /etc/ssl/private/carina.key;

    location / {
        proxy_pass http://127.0.0.1:3333;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-User $remote_user;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Secure Headers
Add these to your reverse proxy:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Content-Security-Policy: default-src 'self'
Strict-Transport-Security: max-age=31536000
```

## Secrets Management

### Environment Variables
Never commit `.env` to version control. Use the provided template:

```bash
cp .env.example .env
# Edit .env with your keys
# .env is in .gitignore by default
```

### Secrets Reload
Rotate secrets without restarting:

```bash
carina secrets reload
```

### Audit
Check for exposed secrets:

```bash
carina security audit
# Checks: .env in git, weak tokens, default passwords, exposed ports
```

## Firewall

If exposing the Gateway directly:

```bash
# UFW (Ubuntu/Debian)
sudo ufw allow from 192.168.1.0/24 to any port 3333
sudo ufw deny 3333  # block from all other sources

# firewalld (RHEL/Fedora)
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="192.168.1.0/24" port protocol="tcp" port="3333" accept'
sudo firewall-cmd --reload
```

## Scout Integration

Enable Labyrinth Scout for continuous security monitoring:

```bash
export CARINA_SCOUT_ENABLED=true
export CARINA_SCOUT_URL="http://localhost:4444"
```

Scout provides:
- Real-time prompt injection detection
- Anomaly detection (behavioural heuristics)
- Egress filtering and DLP
- Automated kill switch
- Immutable audit logging

## Security Checklist

- [ ] Gateway token set (not default)
- [ ] Gateway binds to loopback or reverse proxy
- [ ] TLS configured on reverse proxy
- [ ] `.env` not committed to git
- [ ] Scout enabled for production
- [ ] Sandbox mode set for untrusted agents
- [ ] Firewall restricts Gateway port
- [ ] Regular `carina security audit` scheduled

## Where to find it in source
- `security/kill-switch-listener.ts` -- runtime security
- `security/rasp/` -- RASP engine
- `config/schema.ts` -- security configuration
```

---

## Sidebar update

Add both pages under the "Security" category in `sidebars.ts`.

---

## Existing Carina files to reference

- `internal/servers/core.carinaai.uk/src/security/sandbox/`
- `internal/servers/core.carinaai.uk/src/security/kill-switch-listener.ts`
- `internal/servers/core.carinaai.uk/src/security/rasp/`
