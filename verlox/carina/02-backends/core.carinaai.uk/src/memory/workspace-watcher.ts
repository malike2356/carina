import fs from 'fs';
import path from 'path';
import { CARINA_HOME } from '../config/paths.js';
import { listAgentDefinitions } from '../workspaces/agent-registry.js';
import { resolveAgentWorkspace } from '../workspaces/paths.js';

export type WorkspaceChangeKind = 'add' | 'change' | 'unlink';

export type WorkspaceChange = {
  path: string;
  workspace: string;
  kind: WorkspaceChangeKind;
  at: string;
};

type WatchState = {
  watchers: fs.FSWatcher[];
  debounceTimers: Map<string, ReturnType<typeof setTimeout>>;
  audit: WorkspaceChange[];
};

const MAX_AUDIT = 500;
const DEFAULT_DEBOUNCE_MS = 400;

let state: WatchState | null = null;

function auditPath(): string {
  return path.join(CARINA_HOME, 'workspace-watch-audit.json');
}

function loadAudit(): WorkspaceChange[] {
  try {
    const raw = JSON.parse(fs.readFileSync(auditPath(), 'utf8')) as { changes?: WorkspaceChange[] };
    return Array.isArray(raw.changes) ? raw.changes : [];
  } catch {
    return [];
  }
}

function persistAudit(changes: WorkspaceChange[]): void {
  fs.mkdirSync(CARINA_HOME, { recursive: true });
  fs.writeFileSync(auditPath(), JSON.stringify({ version: 1, changes }, null, 2), 'utf8');
}

function recordChange(change: WorkspaceChange): void {
  if (!state) return;
  state.audit.unshift(change);
  if (state.audit.length > MAX_AUDIT) {
    state.audit.length = MAX_AUDIT;
  }
  persistAudit(state.audit);
}

function workspaceDirs(): string[] {
  const dirs = new Set<string>();
  try {
    for (const agent of listAgentDefinitions()) {
      const ws = resolveAgentWorkspace(agent);
      if (fs.existsSync(ws)) dirs.add(ws);
    }
  } catch {
    // agent registry may be empty during bootstrap
  }
  const globalWs = path.join(CARINA_HOME, 'workspaces');
  if (fs.existsSync(globalWs)) dirs.add(globalWs);
  return [...dirs];
}

function scheduleRecord(
  workspace: string,
  filePath: string,
  kind: WorkspaceChangeKind,
  debounceMs: number,
): void {
  if (!state) return;
  const key = `${workspace}:${filePath}:${kind}`;
  const existing = state.debounceTimers.get(key);
  if (existing) clearTimeout(existing);
  state.debounceTimers.set(
    key,
    setTimeout(() => {
      state?.debounceTimers.delete(key);
      recordChange({
        path: filePath,
        workspace,
        kind,
        at: new Date().toISOString(),
      });
    }, debounceMs),
  );
}

export function getRecentWorkspaceChanges(limit = 20): WorkspaceChange[] {
  if (state) return state.audit.slice(0, limit);
  return loadAudit().slice(0, limit);
}

export function startWorkspaceWatcher(): () => void {
  if (state) return () => stopWorkspaceWatcher();

  const debounceMs = Number(process.env.CARINA_WORKSPACE_WATCH_DEBOUNCE_MS ?? DEFAULT_DEBOUNCE_MS);
  const enabled = process.env.CARINA_WORKSPACE_WATCH !== 'false';
  if (!enabled) return () => undefined;

  state = {
    watchers: [],
    debounceTimers: new Map(),
    audit: loadAudit(),
  };

  for (const workspace of workspaceDirs()) {
    try {
      const watcher = fs.watch(workspace, { recursive: true }, (event, filename) => {
        if (!filename || !state) return;
        const filePath = path.join(workspace, filename.toString());
        const kind: WorkspaceChangeKind = event === 'rename'
          ? (fs.existsSync(filePath) ? 'add' : 'unlink')
          : 'change';
        scheduleRecord(workspace, filePath, kind, debounceMs);
      });
      state.watchers.push(watcher);
    } catch (err) {
      console.warn(`[workspace-watch] skipped ${workspace}:`, err instanceof Error ? err.message : err);
    }
  }

  return () => stopWorkspaceWatcher();
}

export function stopWorkspaceWatcher(): void {
  if (!state) return;
  for (const timer of state.debounceTimers.values()) clearTimeout(timer);
  for (const watcher of state.watchers) watcher.close();
  state = null;
}

export function clearWorkspaceWatchAuditForTests(): void {
  if (state) state.audit = [];
  try {
    fs.unlinkSync(auditPath());
  } catch {
    // ignore
  }
}
