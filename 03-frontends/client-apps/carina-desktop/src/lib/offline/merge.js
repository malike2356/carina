export function mergeSessionMessages(local, server) {
    const byId = new Map();
    for (const message of server) {
        byId.set(message.id, message);
    }
    for (const message of local) {
        if (!byId.has(message.id)) {
            byId.set(message.id, message);
        }
    }
    return [...byId.values()].sort((a, b) => a.timestamp - b.timestamp);
}
export function hasPendingLocalMessages(local, server) {
    const serverIds = new Set(server.map((m) => m.id));
    return local.some((m) => !serverIds.has(m.id));
}
export function memoryNeedsConflict(local, server) {
    if (local.updatedAt === server.updatedAt)
        return false;
    if (local.syncedAt && local.updatedAt <= local.syncedAt)
        return false;
    return local.content.trim() !== server.content.trim();
}
export function pickMemoryWinner(local, server, prefer) {
    if (prefer === 'local')
        return { ...local, syncedAt: new Date().toISOString() };
    return { ...server, syncedAt: new Date().toISOString() };
}
export function scrollToChatMessages(messages) {
    return messages.map((message) => ({
        id: message.id,
        role: message.role === 'assistant' || message.role === 'tool' ? message.role : 'user',
        content: message.content,
        timestamp: new Date(message.createdAt).getTime(),
    }));
}
