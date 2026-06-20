const SESSIONS_KEY = 'carina_desktop_sessions';
const MESSAGES_KEY = 'carina_desktop_messages';
function readSessions() {
    try {
        return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]');
    }
    catch {
        return [];
    }
}
function writeSessions(sessions) {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(0, 50)));
}
function readMessagesStore() {
    try {
        return JSON.parse(localStorage.getItem(MESSAGES_KEY) || '{}');
    }
    catch {
        return {};
    }
}
function writeMessagesStore(store) {
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(store));
}
export function toSessionInfo(entry, messageCount = 0) {
    return {
        sessionId: entry.id,
        agentId: 'main',
        createdAt: new Date(entry.at).toISOString(),
        updatedAt: new Date(entry.at).toISOString(),
        messageCount,
        title: entry.preview || 'New session',
    };
}
export function listLocalSessions() {
    const store = readMessagesStore();
    return readSessions().map((entry) => toSessionInfo(entry, store[entry.id]?.length ?? 0));
}
export function createLocalSession() {
    const id = crypto.randomUUID();
    const entry = { id, preview: 'New session', at: Date.now() };
    writeSessions([entry, ...readSessions()]);
    return toSessionInfo(entry, 0);
}
export function touchLocalSession(sessionId, preview) {
    const sessions = readSessions().filter((s) => s.id !== sessionId);
    sessions.unshift({
        id: sessionId,
        preview: preview.slice(0, 60) || 'New session',
        at: Date.now(),
    });
    writeSessions(sessions);
}
export function loadLocalMessages(sessionId) {
    return readMessagesStore()[sessionId] ?? [];
}
export function saveLocalMessages(sessionId, messages) {
    const store = readMessagesStore();
    store[sessionId] = messages;
    writeMessagesStore(store);
    const preview = messages.find((m) => m.role === 'user')?.content
        ?? messages.find((m) => m.role === 'assistant')?.content
        ?? 'New session';
    touchLocalSession(sessionId, preview);
}
export function renameLocalSession(sessionId, title) {
    const sessions = readSessions();
    const next = sessions.map((entry) => entry.id === sessionId ? { ...entry, preview: title.slice(0, 60) || 'New session' } : entry);
    writeSessions(next);
}
export function deleteLocalSession(sessionId) {
    writeSessions(readSessions().filter((entry) => entry.id !== sessionId));
    const store = readMessagesStore();
    delete store[sessionId];
    writeMessagesStore(store);
}
