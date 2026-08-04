import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('workspace-watcher', () => {
  let tmpHome: string;
  let workspace: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-wswatch-'));
    workspace = path.join(tmpHome, 'workspaces', 'main');
    fs.mkdirSync(workspace, { recursive: true });
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.stubEnv('CARINA_WORKSPACE_WATCH_DEBOUNCE_MS', '50');
    vi.resetModules();
  });

  afterEach(async () => {
    const mod = await import('./workspace-watcher.js');
    mod.stopWorkspaceWatcher();
    mod.clearWorkspaceWatchAuditForTests();
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('records file changes in audit log', async () => {
    const mod = await import('./workspace-watcher.js');
    mod.startWorkspaceWatcher();

    const target = path.join(workspace, 'AGENTS.md');
    fs.writeFileSync(target, 'hello', 'utf8');
    fs.appendFileSync(target, '\nworld', 'utf8');

    await new Promise((r) => setTimeout(r, 120));

    const changes = mod.getRecentWorkspaceChanges(10);
    expect(changes.length).toBeGreaterThan(0);
    expect(changes[0]?.path).toContain('AGENTS.md');
    expect(changes[0]?.workspace).toContain('workspaces');
  });
});
