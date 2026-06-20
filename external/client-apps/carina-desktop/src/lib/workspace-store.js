const WORKSPACE_KEY = 'carina_desktop_workspaces';
function defaultStore() {
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
function readLocalStore() {
    try {
        const parsed = JSON.parse(localStorage.getItem(WORKSPACE_KEY) || '{}');
        if (!parsed.workspaces?.length)
            return defaultStore();
        return parsed;
    }
    catch {
        return defaultStore();
    }
}
function writeLocalStore(store) {
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(store));
}
export function getLocalWorkspaces() {
    const store = readLocalStore();
    return { workspaces: store.workspaces, activeId: store.activeId };
}
export function createLocalWorkspace(name, color, icon) {
    const store = readLocalStore();
    const workspace = {
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
export function switchLocalWorkspace(id) {
    const store = readLocalStore();
    store.activeId = id;
    writeLocalStore(store);
}
export function deleteLocalWorkspace(id) {
    const store = readLocalStore();
    store.workspaces = store.workspaces.filter((workspace) => workspace.id !== id);
    if (store.activeId === id)
        store.activeId = 'default';
    writeLocalStore(store);
}
