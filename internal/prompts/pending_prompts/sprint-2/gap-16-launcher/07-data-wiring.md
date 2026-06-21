# Prompt 07: Data Wiring - Hooks and API for All Launcher Forms


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

Prompts 01-06 defined all four launcher UIs. This prompt wires them to real data.
Each launcher form depends on 5 data domains:
- Current user (name, role, avatar)
- Recent projects (3-5 most recently touched)
- Project count (total for badge)
- System status (Scout health, version, uptime)
- Active session flag (decides whether to show launcher or go straight to chat)

The web and desktop launchers share a single REST API (`/api/*`). The mobile launcher
calls the same API over the network. The TUI hooks call internal Node.js modules directly
(no HTTP, same process).

## What to Build

### 1. API routes (web + desktop)

Add to `apps/cloud/src/server.ts`:

```ts
import { getRecentProjects, getProjectCount } from './lib/projects';
import { getCurrentUser } from './lib/users';
import { getSystemStatus, getSystemHealth } from './lib/system';

// Current user
app.get('/api/me', async (req, res) => {
  const user = await getCurrentUser(req);
  res.json(user);
});

// Recent projects
app.get('/api/projects/recent', async (req, res) => {
  const limit = Number(req.query.limit ?? 3);
  const projects = await getRecentProjects(req.userId, limit);
  res.json({ projects });
});

// All projects count + list
app.get('/api/projects', async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const result = await getProjectCount(req.userId);
  res.json(result);
});

// Active session check
app.get('/api/session/active', async (req, res) => {
  const session = await getActiveSession(req.userId);
  res.json({ session });
});

// System status (for status bar)
app.get('/api/system/status', async (_req, res) => {
  const status = await getSystemStatus();
  res.json(status);
});

// System health (for expanded orbital view)
app.get('/api/system/health', async (_req, res) => {
  const health = await getSystemHealth();
  res.json(health);
});
```

### 2. Data shapes

```ts
// apps/cloud/src/lib/types/launcher.ts

export interface LauncherUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'Owner' | 'Admin' | 'Member';
  avatarUrl: string | null;
}

export interface LauncherProject {
  id: string;
  name: string;
  workspaceType: string; // e.g., "Real Estate", "Legal", "Support"
  color: string; // hex, for icon background
  iconUrl: string; // relative path or data URI
  lastActivityAt: string; // ISO date
  lastActivityAgo: string; // human: "2 min ago", "1 hr ago", "3 days ago"
  active: boolean;
}

export interface SystemStatus {
  scout: { ok: boolean; status: string; lastScanAgo: string };
  version: string;
  encrypted: boolean;
  synced: boolean;
  uptime: string;
}

export interface SystemHealth {
  overallPercent: number;
  subsystems: Array<{
    id: string;
    label: string;
    healthPercent: number;
  }>;
  activeSessions: number;
  memoryCount: number;
  skillsLoaded: number;
  scoutLastScanAgo: string;
}
```

### 3. Web/desktop React hooks

File: `apps/cloud/src/hooks/useCurrentUser.ts`
```ts
import { useEffect, useState } from 'react';
import type { LauncherUser } from '../lib/types/launcher';

export function useCurrentUser() {
  const [user, setUser] = useState<LauncherUser | null>(null);
  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(setUser).catch(() => {});
  }, []);
  return { user };
}
```

File: `apps/cloud/src/hooks/useRecentProjects.ts`
```ts
import { useEffect, useState } from 'react';
import type { LauncherProject } from '../lib/types/launcher';

export function useRecentProjects(limit = 3) {
  const [recentProjects, setRecentProjects] = useState<LauncherProject[]>([]);
  useEffect(() => {
    fetch(`/api/projects/recent?limit=${limit}`)
      .then(r => r.json())
      .then(d => setRecentProjects(d.projects ?? []))
      .catch(() => {});
  }, [limit]);
  return { recentProjects };
}
```

File: `apps/cloud/src/hooks/useProjects.ts`
```ts
import { useEffect, useState } from 'react';

export function useProjects() {
  const [totalCount, setTotalCount] = useState(0);
  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(d => setTotalCount(d.total ?? 0)).catch(() => {});
  }, []);
  return { totalCount };
}
```

File: `apps/cloud/src/hooks/useActiveSession.ts`
```ts
import { useEffect, useState } from 'react';

export function useActiveSession() {
  const [session, setSession] = useState<null | object>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/session/active')
      .then(r => r.json())
      .then(d => { setSession(d.session); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);
  return { session, loading };
}
```

File: `apps/cloud/src/hooks/useSystemStatus.ts`
```ts
import { useEffect, useState } from 'react';
import type { SystemStatus } from '../lib/types/launcher';

export function useSystemStatus() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  useEffect(() => {
    const load = () =>
      fetch('/api/system/status').then(r => r.json()).then(setStatus).catch(() => {});
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);
  return { status };
}
```

File: `apps/cloud/src/hooks/useSystemHealth.ts`
```ts
import { useEffect, useState } from 'react';
import type { SystemHealth } from '../lib/types/launcher';

export function useSystemHealth() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  useEffect(() => {
    const load = () =>
      fetch('/api/system/health').then(r => r.json()).then(setHealth).catch(() => {});
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);
  return { health };
}
```

### 4. Mobile hooks (same shape, different base URL)

Create `carinaMobile/hooks/api.ts`:
```ts
export const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://app.carinaai.uk';

export async function apiFetch(path: string) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}
```

Each mobile hook uses `apiFetch` instead of `fetch`:
```ts
// carinaMobile/hooks/useCurrentUser.ts
import { useEffect, useState } from 'react';
import { apiFetch } from './api';

export function useCurrentUser() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    apiFetch('/api/me').then(setUser).catch(() => {});
  }, []);
  return { user };
}
```

Same pattern for `useRecentProjects`, `useActiveSession`, `useSystemStatus`.

### 5. TUI hooks (Node.js, same process)

The TUI hooks import from internal modules directly:

```ts
// core.carinaai.uk/src/ui/tui/hooks/useSystemStatus.ts
import { useState, useEffect } from 'react';
import { getSystemStatus } from '../../../lib/system';

export function useSystemStatus() {
  const [status, setStatus] = useState<Record<string, string>>({
    model:    'loading...',
    memory:   'loading...',
    scout:    'loading...',
    channels: 'loading...',
    skills:   'loading...',
    latency:  'loading...',
    sessions: 'loading...',
    uptime:   'loading...',
  });

  useEffect(() => {
    getSystemStatus().then(s => {
      setStatus({
        model:    s.modelId,
        memory:   `${s.memoryCount} records`,
        scout:    s.scout.ok ? 'protected' : 'offline',
        channels: `${s.channelCount} active`,
        skills:   `${s.skillsLoaded} loaded`,
        latency:  s.lastLatencyMs ? `${s.lastLatencyMs}ms` : '< 200ms',
        sessions: `${s.activeSessions} running`,
        uptime:   s.uptimeFormatted,
      });
    }).catch(() => {});
  }, []);

  return { status };
}
```

```ts
// core.carinaai.uk/src/ui/tui/hooks/useRecentProjects.ts
import { useState, useEffect } from 'react';
import { listProjects } from '../../../lib/projects';

export function useRecentProjects(limit = 5) {
  const [recentProjects, setRecentProjects] = useState([]);
  useEffect(() => {
    listProjects({ sort: 'lastActivityAt', order: 'desc', limit })
      .then(p => setRecentProjects(p))
      .catch(() => {});
  }, [limit]);
  return { recentProjects };
}
```

### 6. lastActivityAgo helper

```ts
// apps/cloud/src/lib/time.ts  (also import in mobile/carinaMobile/lib/time.ts)
export function lastActivityAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}
```

Call this in `getRecentProjects()` to set the `lastActivityAgo` field on each project
before returning.

### 7. Skeleton / loading states

While data is loading, all three web/desktop hooks return `null`. The launcher
components should show placeholder skeleton rows:

```tsx
// ProjectResumeCard skeleton
if (!project) return (
  <div className="project-card project-card-skeleton">
    <div className="skeleton skeleton-icon" />
    <div className="skeleton-text">
      <div className="skeleton skeleton-line" style={{ width: '60%' }} />
      <div className="skeleton skeleton-line" style={{ width: '40%' }} />
    </div>
  </div>
);
```

CSS:
```css
.skeleton {
  background: linear-gradient(90deg, #0d1829 25%, #1a2b45 50%, #0d1829 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  border-radius: 4px;
}
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.skeleton-icon  { width: 40px; height: 40px; border-radius: 8px; }
.skeleton-line  { height: 12px; margin-bottom: 6px; }
```

Show 3 skeleton cards while `recentProjects.length === 0 && loading`.

## Verification Checklist

- [ ] All 6 hooks (useCurrentUser, useRecentProjects, useProjects, useActiveSession, useSystemStatus, useSystemHealth) have no TypeScript errors
- [ ] All 6 API routes return correct JSON shapes
- [ ] lastActivityAgo outputs correctly for < 1 min, < 1 hr, < 1 day, and multi-day
- [ ] Skeleton cards appear while fetching and disappear when data arrives
- [ ] Mobile hooks use EXPO_PUBLIC_API_URL env var
- [ ] TUI hooks import from internal modules (no fetch() in CLI process)
- [ ] useSystemStatus and useSystemHealth poll every 30 seconds and clear intervals on unmount
- [ ] getSystemStatus() in `core.carinaai.uk/src/lib/system.ts` returns all expected fields

## Files to Create or Modify

- CREATE `apps/cloud/src/lib/types/launcher.ts`
- CREATE `apps/cloud/src/lib/time.ts`
- CREATE `apps/cloud/src/hooks/useCurrentUser.ts`
- CREATE `apps/cloud/src/hooks/useRecentProjects.ts`
- CREATE `apps/cloud/src/hooks/useProjects.ts`
- CREATE `apps/cloud/src/hooks/useActiveSession.ts`
- CREATE `apps/cloud/src/hooks/useSystemStatus.ts`
- CREATE `apps/cloud/src/hooks/useSystemHealth.ts`
- MODIFY `apps/cloud/src/server.ts` - add 6 launcher API routes
- CREATE `carinaMobile/hooks/api.ts`
- CREATE `carinaMobile/hooks/useCurrentUser.ts`
- CREATE `carinaMobile/hooks/useRecentProjects.ts`
- CREATE `carinaMobile/hooks/useActiveSession.ts`
- CREATE `carinaMobile/hooks/useSystemStatus.ts`
- CREATE `core.carinaai.uk/src/ui/tui/hooks/useSystemStatus.ts`
- CREATE `core.carinaai.uk/src/ui/tui/hooks/useRecentProjects.ts`
- MODIFY `core.carinaai.uk/src/lib/projects.ts` - ensure listProjects() sets lastActivityAgo
- MODIFY `core.carinaai.uk/src/lib/system.ts` - ensure getSystemStatus() returns all TUI fields
