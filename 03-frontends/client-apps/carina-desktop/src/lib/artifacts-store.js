import { loadLocalMessages, listLocalSessions } from './session-store.js';
const ARTIFACTS_KEY = 'carina_desktop_artifacts';
function readArtifactStore() {
    try {
        return JSON.parse(localStorage.getItem(ARTIFACTS_KEY) || '{}');
    }
    catch {
        return {};
    }
}
function writeArtifactStore(store) {
    localStorage.setItem(ARTIFACTS_KEY, JSON.stringify(store));
}
export function deriveArtifactsFromMessages() {
    const sessions = listLocalSessions();
    const derived = [];
    for (const session of sessions) {
        const messages = loadLocalMessages(session.sessionId);
        for (const message of messages) {
            if (message.role !== 'assistant')
                continue;
            const codeMatch = message.content.match(/```(\w+)?\n([\s\S]*?)```/);
            if (codeMatch) {
                const content = codeMatch[2] ?? '';
                derived.push({
                    id: `art-${message.id}`,
                    type: 'code',
                    title: `${codeMatch[1] ?? 'code'} snippet`,
                    sessionId: session.sessionId,
                    createdAt: new Date(message.timestamp).toISOString(),
                    size: content.length,
                    content,
                    language: codeMatch[1] ?? 'text',
                });
            }
        }
    }
    return derived;
}
export function listLocalArtifacts() {
    const stored = Object.values(readArtifactStore());
    const derived = deriveArtifactsFromMessages();
    const merged = new Map();
    for (const item of [...derived, ...stored])
        merged.set(item.id, item);
    return [...merged.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function getLocalArtifact(id) {
    return listLocalArtifacts().find((item) => item.id === id) ?? null;
}
export function saveLocalArtifact(artifact) {
    const store = readArtifactStore();
    store[artifact.id] = artifact;
    writeArtifactStore(store);
}
export function sessionTitle(sessionId) {
    return listLocalSessions().find((s) => s.sessionId === sessionId)?.title ?? sessionId.slice(0, 12);
}
export function exportSessionMarkdown(sessionId, messages) {
    const title = sessionTitle(sessionId);
    const lines = [`# ${title}`, '', `Session: ${sessionId}`, ''];
    for (const message of messages) {
        lines.push(`## ${message.role === 'user' ? 'You' : 'Carina'}`, '', message.content, '');
    }
    return lines.join('\n');
}
export function exportSessionJson(sessionId, messages) {
    return JSON.stringify({ sessionId, exportedAt: new Date().toISOString(), messages }, null, 2);
}
export function exportSessionText(_sessionId, messages) {
    return messages.map((m) => `${m.role === 'user' ? 'You' : 'Carina'}: ${m.content}`).join('\n\n');
}
export function downloadTextFile(filename, content, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}
