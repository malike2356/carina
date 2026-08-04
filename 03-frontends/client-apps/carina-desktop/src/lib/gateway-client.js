import { createLocalSession, listLocalSessions, } from './session-store.js';
const GATEWAY_BASE = import.meta.env.VITE_GATEWAY_BASE ?? 'http://localhost:3333';
async function post(path, body) {
    const res = await fetch(`${GATEWAY_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Carina-Surface': 'desktop' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Gateway error ${res.status}: ${text}`);
    }
    return res.json();
}
async function get(path) {
    const res = await fetch(`${GATEWAY_BASE}${path}`, {
        headers: { 'X-Carina-Surface': 'desktop' },
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Gateway error ${res.status}: ${text}`);
    }
    return res.json();
}
export async function getHealth() {
    try {
        const result = await get('/health');
        if (result.ok === true) {
            return { status: 'ok', version: result.version, uptime: result.uptime };
        }
        if (result.status === 'ok' || result.status === 'degraded') {
            return { status: result.status, version: result.version, uptime: result.uptime };
        }
        return { status: 'degraded', version: result.version, uptime: result.uptime };
    }
    catch {
        return { status: 'down' };
    }
}
export async function listSessions() {
    try {
        return await get('/api/sessions');
    }
    catch {
        return listLocalSessions();
    }
}
export function toSessionInfoFromMemory(entry) {
    return {
        sessionId: entry.session_id,
        agentId: 'main',
        createdAt: entry.last_active,
        updatedAt: entry.last_active,
        messageCount: 0,
        title: entry.title || entry.preview || entry.session_id.slice(0, 12),
    };
}
export async function fetchMemorySessions(limit = 50) {
    const data = await get(`/api/memory/sessions?limit=${limit}`);
    return data.sessions ?? [];
}
export async function fetchMemoryRecords(page = 1) {
    const data = await get(`/api/memory?page=${page}`);
    const records = data.entries ?? data.records ?? [];
    if (records.length >= 20) {
        const next = await fetchMemoryRecords(page + 1).catch(() => []);
        return [...records, ...next];
    }
    return records;
}
export async function scrollSessionMessages(sessionId, options) {
    const params = new URLSearchParams({
        limit: String(options?.limit ?? 50),
        direction: options?.direction ?? 'older',
    });
    if (options?.cursor)
        params.set('cursor', options.cursor);
    return get(`/api/memory/sessions/${encodeURIComponent(sessionId)}/scroll?${params.toString()}`);
}
export function isGatewayOnline(status) {
    return status === 'ok' || status === 'degraded';
}
export async function getSession(sessionId) {
    try {
        return await get(`/api/sessions/${sessionId}`);
    }
    catch {
        const local = listLocalSessions().find((s) => s.sessionId === sessionId);
        if (!local)
            throw new Error('Session not found');
        return local;
    }
}
export async function createSession() {
    try {
        return await post('/api/sessions', { surface: 'desktop' });
    }
    catch {
        return createLocalSession();
    }
}
export async function submitPrompt(sessionId, content, options) {
    return post('/api/chat', {
        sessionId,
        content,
        source: 'desktop',
        agentId: options?.agentId,
    });
}
export async function cancelRun(sessionId, turnId) {
    await post('/api/chat/cancel', { sessionId, turnId });
}
export async function respondToApproval(sessionId, runId, approved) {
    await post('/api/chat/approve', { sessionId, runId, approved });
}
export function openChatStream(params) {
    const query = new URLSearchParams({
        message: params.message,
        sessionId: params.sessionId,
        turnId: params.turnId,
    });
    return new EventSource(`${GATEWAY_BASE}/api/chat/stream?${query.toString()}`);
}
/** @deprecated Use openChatStream for message submission streams. */
export function openStream(sessionId) {
    return new EventSource(`${GATEWAY_BASE}/api/stream/${sessionId}`);
}
export async function getCommands() {
    try {
        return await get('/api/commands');
    }
    catch {
        const { BUILTIN_SLASH_COMMANDS } = await import('./slash-commands.js');
        return BUILTIN_SLASH_COMMANDS;
    }
}
export async function listSkills() {
    try {
        const data = await get('/api/skills');
        return data.skills ?? [];
    }
    catch {
        return [];
    }
}
export async function listActiveAgents() {
    try {
        return await get('/api/agents/active');
    }
    catch {
        return [{ id: 'main', name: 'main' }];
    }
}
export async function transcribeAudio(blob, mimeType = 'audio/webm') {
    const res = await fetch(`${GATEWAY_BASE}/api/transcribe`, {
        method: 'POST',
        headers: {
            'Content-Type': mimeType,
            'X-Carina-Surface': 'desktop',
        },
        body: blob,
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Transcription failed (${res.status})`);
    }
    const data = await res.json();
    return (data.text ?? data.transcript ?? '').trim();
}
export async function fetchUrlMetadata(url) {
    try {
        return await post('/api/url/preview', { url });
    }
    catch {
        let hostname = url;
        try {
            hostname = new URL(url).hostname;
        }
        catch {
            // keep raw url
        }
        return { url, title: hostname, favicon: `https://www.google.com/s2/favicons?domain=${hostname}` };
    }
}
export async function getAgents() {
    try {
        return await get('/api/agents');
    }
    catch {
        return [];
    }
}
export async function getAgent(id) {
    try {
        return await get(`/api/agents/${id}`);
    }
    catch {
        return (await getAgents()).find((agent) => agent.id === id) ?? null;
    }
}
export async function cancelAgent(id) {
    await post(`/api/agents/${id}/cancel`, {});
}
export async function getArtifacts() {
    try {
        return await get('/api/artifacts');
    }
    catch {
        const { listLocalArtifacts } = await import('./artifacts-store.js');
        return listLocalArtifacts();
    }
}
export async function getArtifact(id) {
    try {
        return await get(`/api/artifacts/${id}`);
    }
    catch {
        const { getLocalArtifact } = await import('./artifacts-store.js');
        return getLocalArtifact(id);
    }
}
export async function getSkills() {
    try {
        const data = await get('/api/skills');
        return data.packs ?? data.skills ?? [];
    }
    catch {
        const skills = await listSkills();
        return skills.map((skill) => ({
            name: skill.name,
            description: skill.description,
            enabled: true,
        }));
    }
}
export async function installSkill(name) {
    await post('/api/skills/install', { name });
}
export async function uninstallSkill(name) {
    await post('/api/skills/uninstall', { name });
}
export async function searchHubSkills(query) {
    try {
        const data = await get(`/api/hub/skills/search?q=${encodeURIComponent(query)}`);
        return data.results ?? [];
    }
    catch {
        return [];
    }
}
export async function getPairedDevices() {
    try {
        const data = await get('/api/pair/devices');
        return Array.isArray(data) ? data : (data.devices ?? []);
    }
    catch {
        return [];
    }
}
export async function generatePairingToken() {
    try {
        return await post('/api/pairing/tokens', {});
    }
    catch {
        try {
            const code = await post('/api/pairing/code', {});
            const token = code.code;
            return {
                token,
                expiresAt: code.expiresAt,
                uri: `carina://pair?token=${token}`,
            };
        }
        catch {
            throw new Error('Pairing unavailable. Run `carina pair` on the gateway host.');
        }
    }
}
export async function revokePairedDevice(id) {
    const res = await fetch(`${GATEWAY_BASE}/api/pair/devices/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'X-Carina-Surface': 'desktop' },
    });
    if (!res.ok && res.status !== 204) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Revoke failed (${res.status})`);
    }
}
export async function getProviders() {
    return get('/api/providers');
}
export async function switchProvider(provider) {
    await post('/api/providers/switch', { provider });
}
export async function testProviderKey(provider, apiKey) {
    try {
        return await post('/api/providers/test-key', { provider, apiKey });
    }
    catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : 'Test failed' };
    }
}
export async function saveProviderKey(provider, apiKey) {
    await post('/api/providers/keys', { provider, apiKey });
}
export async function getChannels() {
    try {
        return await get('/api/channels');
    }
    catch {
        return [];
    }
}
export async function openEventsStream(onEvent) {
    const es = new EventSource(`${GATEWAY_BASE}/api/events/stream`);
    es.onmessage = (ev) => {
        try {
            onEvent(JSON.parse(ev.data));
        }
        catch {
            onEvent(ev.data);
        }
    };
    for (const type of ['tool', 'agent', 'approval', 'message', 'error']) {
        es.addEventListener(type, (ev) => {
            const messageEvent = ev;
            try {
                onEvent(JSON.parse(messageEvent.data));
            }
            catch {
                onEvent({ type, raw: messageEvent.data });
            }
        });
    }
    return es;
}
export async function lspRequest(method, params, options) {
    try {
        const data = await post('/api/lsp/request', {
            sessionKey: options?.sessionKey,
            method,
            params,
            language: options?.language,
        });
        return data.result ?? null;
    }
    catch {
        return null;
    }
}
export async function completePairing(token) {
    await post('/api/pairing/complete', { token });
}
export async function getTrustScore() {
    try {
        return await get('/api/security/trust-score');
    }
    catch {
        return { score: 72, scoutConnected: false, scoutUrl: null };
    }
}
export async function getSecurityEvents(limit = 5) {
    try {
        const data = await get(`/api/security/events?limit=${limit}`);
        return data.events ?? [];
    }
    catch {
        return [];
    }
}
export async function getKillSwitchStatus() {
    try {
        return await get('/api/security/kill-switch-status');
    }
    catch {
        return { active: false, reason: '' };
    }
}
export async function getBillingPlan() {
    try {
        return await get('/api/billing/plan');
    }
    catch {
        return { id: 'free', name: 'Carina Core', tokenLimit: 100_000, includedCredits: 50_000, monthlyPriceGbp: 0 };
    }
}
export async function getBillingUsage() {
    try {
        return await get('/api/billing/usage');
    }
    catch {
        return {
            periodStart: new Date().toISOString(),
            periodEnd: new Date().toISOString(),
            tokensUsed: 0,
            tokenLimit: 100_000,
            messagesSent: 0,
            creditsRemaining: 50_000,
            estimatedCostUsd: 0,
            budgetStatus: 'ok',
        };
    }
}
export async function getBillingSessions(limit = 5) {
    try {
        const data = await get(`/api/billing/sessions?limit=${limit}`);
        return data.sessions ?? [];
    }
    catch {
        return [];
    }
}
export async function getWorkspaces() {
    try {
        return await get('/api/workspaces');
    }
    catch {
        const { getLocalWorkspaces } = await import('./workspace-store.js');
        return getLocalWorkspaces();
    }
}
export async function createWorkspace(name, color, icon) {
    try {
        const data = await post('/api/workspaces', { name, color, icon });
        return data.workspace;
    }
    catch {
        const { createLocalWorkspace } = await import('./workspace-store.js');
        return createLocalWorkspace(name, color, icon);
    }
}
export async function switchWorkspace(id) {
    try {
        await post('/api/workspaces/active', { id });
    }
    catch {
        const { switchLocalWorkspace } = await import('./workspace-store.js');
        switchLocalWorkspace(id);
    }
}
export async function deleteWorkspace(id) {
    const res = await fetch(`${GATEWAY_BASE}/api/workspaces/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'X-Carina-Surface': 'desktop' },
    });
    if (!res.ok) {
        const { deleteLocalWorkspace } = await import('./workspace-store.js');
        deleteLocalWorkspace(id);
    }
}
export async function getCommitments() {
    try {
        const data = await get('/api/commitments');
        return data.commitments ?? [];
    }
    catch {
        return [];
    }
}
export async function completeCommitment(id) {
    await post(`/api/commitments/${encodeURIComponent(id)}/complete`, {});
}
export async function cancelCommitment(id) {
    await post(`/api/commitments/${encodeURIComponent(id)}/cancel`, {});
}
export async function getLearningMetrics() {
    try {
        return await get('/api/metrics/learning');
    }
    catch {
        return { skillSuccessRate: 0, memoriesExtractedWeekly: 0, preferences: [], selfImprovementSkills: [] };
    }
}
export async function getSystemHealth() {
    try {
        return await get('/api/system/health');
    }
    catch {
        return { uptimeSeconds: 0, gatewayStatus: 'down', heapUsedMb: 0, queueDepth: 0, suspended: false };
    }
}
export async function getOrchestrationAgents() {
    try {
        const data = await get('/api/orchestration/active');
        return data.agents ?? [];
    }
    catch {
        return [];
    }
}
export async function runBenchmark() {
    await post('/api/benchmarks/run', {});
}
