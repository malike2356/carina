# Gap 31 - Prompt 02: Service Control

**Status: COMPLETED 2026-06-21**

**Gap:** 31 Ops Server Panel
**Prompt number:** 02 of 03
**Name:** Service status dashboard with restart buttons
**Primary agent:** Cursor
**Estimated hours:** 2 h
**Depends on:** 01-file-browser.md (server-panel.ts and server/index.ejs must exist)

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

1. `backends/admin/ops.carinaai.uk/routes/server-panel.ts` - add new routes to this file
2. `backends/admin/ops.carinaai.uk/middleware/auth.ts` - requireSuperAdmin for restart
3. `core.carinaai.uk/docker/docker-compose.prod.yml` - find the ops service definition

---

## Goal

Add a `/server/services` page that shows live status badges for:
- All running Docker containers (dynamic list from `docker ps`)
- The `php8.3-fpm` systemd service (runs on the VPS host, not in Docker)

Each service has a "Restart" button that calls a JSON endpoint. The page polls
for updated status every 10 seconds without a full reload.

Restart is a superadmin-only operation. Status reads are visible to all admins.

---

## Context: How the ops container reaches the host

The ops.carinaai.uk server runs inside Docker. To restart host systemd services
like `php8.3-fpm` from inside the container, the container needs `pid: "host"` in
its docker-compose definition. This lets `nsenter --target 1 --mount --pid --`
enter the host's PID namespace and run host commands.

For Docker operations (listing containers, restarting Docker containers), the
Docker socket is already mounted at `/var/run/docker.sock` in the ops container
so `docker` CLI commands work directly.

---

## Step 1: docker-compose.prod.yml change

Find the `ops` (or `ops-panel`) service in `core.carinaai.uk/docker/docker-compose.prod.yml`.
Add `pid: "host"` to that service:

```yaml
  ops:
    # ... existing config ...
    pid: "host"
```

This is the only docker-compose change needed.

After this change, the container must be recreated (`docker compose up -d --force-recreate ops`)
for it to take effect. Document this in a comment above the `pid:` line:
```yaml
    # pid: "host" is required for nsenter to reach host systemd (service restarts)
```

---

## Step 2: Create `backends/admin/ops.carinaai.uk/lib/server-services.ts`

```typescript
import { execFile } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execFile);

export type ServiceStatus = 'active' | 'inactive' | 'failed' | 'unknown';

export interface ServiceInfo {
  name: string;
  type: 'systemd' | 'docker';
  status: ServiceStatus;
  detail?: string; // container image or systemd sub-state
  containerId?: string; // docker only
}

// Systemd services that the panel can inspect and restart.
// Extend this list only for services that are safe to restart from the web UI.
const ALLOWED_SYSTEMD = ['php8.3-fpm'] as const;

// Run a command inside the host's namespaces via nsenter.
// Only works when the container has pid: "host".
async function nsenter(args: string[]): Promise<string> {
  const { stdout } = await exec('nsenter', ['--target', '1', '--mount', '--uts', '--ipc', '--pid', '--', ...args]);
  return stdout;
}

export async function getSystemdStatus(service: string): Promise<ServiceInfo> {
  if (!(ALLOWED_SYSTEMD as readonly string[]).includes(service)) {
    return { name: service, type: 'systemd', status: 'unknown', detail: 'Not in allowlist' };
  }
  try {
    const out = await nsenter(['systemctl', 'is-active', service]);
    const active = out.trim();
    const status: ServiceStatus =
      active === 'active' ? 'active' :
      active === 'inactive' ? 'inactive' :
      active === 'failed' ? 'failed' : 'unknown';
    return { name: service, type: 'systemd', status };
  } catch {
    // systemctl is-active exits non-zero when service is not active; parse stdout
    return { name: service, type: 'systemd', status: 'inactive' };
  }
}

export async function restartSystemd(service: string): Promise<void> {
  if (!(ALLOWED_SYSTEMD as readonly string[]).includes(service)) {
    throw new Error('Service not in allowlist');
  }
  await nsenter(['systemctl', 'restart', service]);
}

interface DockerContainer {
  ID: string;
  Names: string;
  Image: string;
  State: string;
  Status: string;
}

export async function getDockerContainers(): Promise<ServiceInfo[]> {
  try {
    const { stdout } = await exec('docker', [
      'ps', '-a',
      '--format', '{"ID":"{{.ID}}","Names":"{{.Names}}","Image":"{{.Image}}","State":"{{.State}}","Status":"{{.Status}}"}',
    ]);
    const lines = stdout.trim().split('\n').filter(Boolean);
    return lines.map(line => {
      let c: DockerContainer;
      try { c = JSON.parse(line) as DockerContainer; } catch { return null; }
      const status: ServiceStatus =
        c.State === 'running' ? 'active' :
        c.State === 'exited' ? 'inactive' :
        c.State === 'dead' ? 'failed' : 'unknown';
      return {
        name: c.Names,
        type: 'docker' as const,
        status,
        detail: c.Image,
        containerId: c.ID,
      };
    }).filter((x): x is ServiceInfo => x !== null);
  } catch {
    return [];
  }
}

export async function restartDockerContainer(nameOrId: string): Promise<void> {
  // Validate: only allow names that appear in our own docker ps output
  const containers = await getDockerContainers();
  const found = containers.find(c => c.name === nameOrId || c.containerId === nameOrId);
  if (!found) throw new Error('Container not found or not managed by this host');
  await exec('docker', ['restart', nameOrId]);
}

export const ALLOWED_SYSTEMD_SERVICES = ALLOWED_SYSTEMD;
```

---

## Step 3: Add service routes to `backends/admin/ops.carinaai.uk/routes/server-panel.ts`

Append to the existing `server-panel.ts` (do not rewrite what is already there):

```typescript
import {
  getSystemdStatus,
  getDockerContainers,
  restartSystemd,
  restartDockerContainer,
  ALLOWED_SYSTEMD_SERVICES,
} from '../lib/server-services.js';

// Services page (HTML)
serverPanelRouter.get('/services', async (_req, res) => {
  const [dockerContainers, ...systemdResults] = await Promise.all([
    getDockerContainers(),
    ...ALLOWED_SYSTEMD_SERVICES.map(s => getSystemdStatus(s)),
  ]);
  res.render('server/services', {
    title: 'Server Services',
    dockerContainers,
    systemdServices: systemdResults,
  });
});

// Status JSON (for polling)
serverPanelRouter.get('/api/services', async (_req, res) => {
  const [dockerContainers, ...systemdResults] = await Promise.all([
    getDockerContainers(),
    ...ALLOWED_SYSTEMD_SERVICES.map(s => getSystemdStatus(s)),
  ]);
  res.json({ docker: dockerContainers, systemd: systemdResults });
});

// Restart (superadmin only)
serverPanelRouter.post('/api/services/restart', requireSuperAdmin, async (req, res) => {
  const { name, type } = req.body as { name?: string; type?: string };
  if (!name || !type) {
    res.status(400).json({ ok: false, error: 'name and type required' });
    return;
  }
  try {
    if (type === 'systemd') {
      await restartSystemd(name);
    } else if (type === 'docker') {
      await restartDockerContainer(name);
    } else {
      throw new Error('Unknown type');
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : 'Restart failed' });
  }
});
```

---

## Step 4: Create `backends/admin/ops.carinaai.uk/views/server/services.ejs`

Requirements:
- Show two sections: "Docker Containers" and "System Services".
- Each row: service name, badge (active = green, inactive = grey, failed = red,
  unknown = yellow), detail text (image name for Docker, nothing for systemd).
- Restart button: visible only to superadmins
  (`<% if (locals.session && session.role === 'superadmin') { %>`).
- Restart button calls `POST /server/api/services/restart` via `fetch` with JSON
  body `{ name, type }`. On success, refresh that row's badge. On error, show the
  error inline next to the button.
- Auto-refresh: every 10 seconds, `fetch('/server/api/services')` and update all
  badge elements by matching `data-service-name` attributes.

Badge HTML pattern:
```html
<span class="status-badge status-<%= svc.status %>" data-service-name="<%= svc.name %>">
  <%= svc.status %>
</span>
```

CSS for badges (add to the view's `<style>` block, or to `public/ops-shell.css`
if the file already has service-related styles):
```css
.status-badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
.status-active  { background: rgba(0,200,100,0.15); color: #00c864; border: 1px solid rgba(0,200,100,0.3); }
.status-inactive { background: rgba(120,120,120,0.15); color: #888; border: 1px solid rgba(120,120,120,0.3); }
.status-failed  { background: rgba(220,50,50,0.15); color: #e05555; border: 1px solid rgba(220,50,50,0.3); }
.status-unknown { background: rgba(220,160,0,0.15); color: #daa520; border: 1px solid rgba(220,160,0,0.3); }
```

Restart button JS pattern:
```js
async function restart(name, type, btn) {
  btn.disabled = true;
  btn.textContent = 'Restarting...';
  try {
    const r = await fetch('/server/api/services/restart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type }),
    });
    const data = await r.json();
    if (!data.ok) throw new Error(data.error);
    btn.textContent = 'Restart';
    btn.disabled = false;
    refreshStatuses(); // re-poll immediately after restart
  } catch (e) {
    btn.textContent = 'Failed: ' + e.message;
    btn.disabled = false;
  }
}
```

---

## Done When

- [ ] `/server/services` renders without errors and shows Docker containers + php8.3-fpm
- [ ] Status badges show correct colour (green for running containers)
- [ ] Page polls every 10 s and updates badges without a full reload
- [ ] Restart buttons are hidden for non-superadmin sessions
- [ ] Clicking restart for a Docker container calls `docker restart` and the badge updates
- [ ] Clicking restart for php8.3-fpm calls `nsenter ... systemctl restart php8.3-fpm`
- [ ] Attempting to restart an unknown service name returns 500 with an error message
- [ ] `docker-compose.prod.yml` has `pid: "host"` on the ops service
- [ ] TypeScript compiles with no errors
