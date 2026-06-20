import type { Workspace } from '../store/carina.js';

const WORKSPACE_KEY = 'carina_desktop_workspaces';

type WorkspaceStore = {
  workspaces: Workspace[];
  activeId: string;
};

function defaultStore(): WorkspaceStore {
  return {
    activeId: 'default',
    workspaces: [{
      id: 'default',
      name: 'Default',
      color: '#6366f1',
      icon: 'C',
      sessionCount: 0,
    }],
  };
}

function readLocalStore(): WorkspaceStore {
  try {
    const parsed = JSON.parse(localStorage.getItem(WORKSPACE_KEY) || '{}') as WorkspaceStore;
    if (!parsed.workspaces?.length) return defaultStore();
    return parsed;
  } catch {
    return defaultStore();
  }
}

function writeLocalStore(store: WorkspaceStore): void {
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(store));
}

export function getLocalWorkspaces(): { workspaces: Workspace[]; activeId: string } {
  const store = readLocalStore();
  return { workspaces: store.workspaces, activeId: store.activeId };
}

export function createLocalWorkspace(name: string, color: string, icon: string): Workspace {
  const store = readLocalStore();
  const workspace: Workspace = {
    id: `ws_${Date.now().toString(36)}`,
    name,
    color,
    icon,
    sessionCount: 0,
  };
  store.workspaces.push(workspace);
  writeLocalStore(store);
  return workspace;
}

export function switchLocalWorkspace(id: string): void {
  const store = readLocalStore();
  store.activeId = id;
  writeLocalStore(store);
}

export function deleteLocalWorkspace(id: string): void {
  const store = readLocalStore();
  store.workspaces = store.workspaces.filter((workspace) => workspace.id !== id);
  if (store.activeId === id) store.activeId = 'default';
  writeLocalStore(store);
}
