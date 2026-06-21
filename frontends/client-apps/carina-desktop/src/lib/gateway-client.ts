import {
  createLocalSession,
  listLocalSessions,
  type SessionInfo,
} from './session-store.js';

const GATEWAY_BASE = import.meta.env.VITE_GATEWAY_BASE ?? 'http://localhost:3333';

export type { SessionInfo };

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  version?: string;
  uptime?: number;
}

export interface SubmitResult {
  sessionId: string;
  runId: string;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${GATEWAY_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Carina-Surface': 'desktop' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gateway error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${GATEWAY_BASE}${path}`, {
    headers: { 'X-Carina-Surface': 'desktop' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gateway error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

type GatewayHealthPayload = {
  ok?: boolean;
  status?: string;
  version?: string;
  uptime?: number;
};

export async function getHealth(): Promise<HealthStatus> {
  try {
    const result = await get<GatewayHealthPayload>('/health');
    if (result.ok === true) {
      return { status: 'ok', version: result.version, uptime: result.uptime };
    }
    if (result.status === 'ok' || result.status === 'degraded') {
      return { status: result.status, version: result.version, uptime: result.uptime };
    }
    return { status: 'degraded', version: result.version, uptime: result.uptime };
  } catch {
    return { status: 'down' };
  }
}

export async function listSessions(): Promise<SessionInfo[]> {
  try {
    return await get<SessionInfo[]>('/api/sessions');
  } catch {
    return listLocalSessions();
  }
}

export async function getSession(sessionId: string): Promise<SessionInfo> {
  try {
    return await get<SessionInfo>(`/api/sessions/${sessionId}`);
  } catch {
    const local = listLocalSessions().find((s) => s.sessionId === sessionId);
    if (!local) throw new Error('Session not found');
    return local;
  }
}

export async function createSession(): Promise<SessionInfo> {
  try {
    return await post<SessionInfo>('/api/sessions', { surface: 'desktop' });
  } catch {
    return createLocalSession();
  }
}

export async function submitPrompt(
  sessionId: string,
  content: string,
  options?: { agentId?: string },
): Promise<SubmitResult> {
  return post<SubmitResult>('/api/chat', {
    sessionId,
    content,
    source: 'desktop',
    agentId: options?.agentId,
  });
}

export async function cancelRun(sessionId: string, turnId: string): Promise<void> {
  await post('/api/chat/cancel', { sessionId, turnId });
}

export async function respondToApproval(
  sessionId: string,
  runId: string,
  approved: boolean,
): Promise<void> {
  await post('/api/chat/approve', { sessionId, runId, approved });
}

export function openChatStream(params: {
  sessionId: string;
  message: string;
  turnId: string;
}): EventSource {
  const query = new URLSearchParams({
    message: params.message,
    sessionId: params.sessionId,
    turnId: params.turnId,
  });
  return new EventSource(`${GATEWAY_BASE}/api/chat/stream?${query.toString()}`);
}

/** @deprecated Use openChatStream for message submission streams. */
export function openStream(sessionId: string): EventSource {
  return new EventSource(`${GATEWAY_BASE}/api/stream/${sessionId}`);
}

export type GatewaySlashCommand = {
  name: string;
  trigger: string;
  description: string;
  category: 'builtin' | 'skill' | 'quick';
};

export async function getCommands(): Promise<GatewaySlashCommand[]> {
  try {
    return await get<GatewaySlashCommand[]>('/api/commands');
  } catch {
    const { BUILTIN_SLASH_COMMANDS } = await import('./slash-commands.js');
    return BUILTIN_SLASH_COMMANDS;
  }
}

export async function listSkills(): Promise<Array<{ name: string; description?: string }>> {
  try {
    const data = await get<{ skills?: Array<{ name: string; description?: string }> }>('/api/skills');
    return data.skills ?? [];
  } catch {
    return [];
  }
}

export async function listActiveAgents(): Promise<Array<{ id: string; name: string }>> {
  try {
    return await get<Array<{ id: string; name: string }>>('/api/agents/active');
  } catch {
    return [{ id: 'main', name: 'main' }];
  }
}

export async function transcribeAudio(blob: Blob, mimeType = 'audio/webm'): Promise<string> {
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
  const data = await res.json() as { text?: string; transcript?: string };
  return (data.text ?? data.transcript ?? '').trim();
}

export async function fetchUrlMetadata(url: string): Promise<{
  url: string;
  title?: string;
  description?: string;
  favicon?: string;
}> {
  try {
    return await post('/api/url/preview', { url });
  } catch {
    let hostname = url;
    try {
      hostname = new URL(url).hostname;
    } catch {
      // keep raw url
    }
    return { url, title: hostname, favicon: `https://www.google.com/s2/favicons?domain=${hostname}` };
  }
}

export type AgentRecord = {
  id: string;
  name: string;
  status: 'running' | 'complete' | 'failed';
  task?: string;
  startedAt?: string;
  endedAt?: string;
  parentSessionId?: string;
  output?: string;
  toolCalls?: Array<{ name: string; status: string }>;
};

export type ArtifactSummary = {
  id: string;
  type: 'html' | 'svg' | 'markdown' | 'code' | 'image' | 'data';
  title: string;
  sessionId: string;
  createdAt: string;
  size: number;
  content?: string;
  language?: string;
};

export type SkillPack = {
  name: string;
  version?: string;
  author?: string;
  description?: string;
  enabled?: boolean;
  lastUsedAt?: string;
};

export type HubSkill = {
  name: string;
  description?: string;
  rating?: number;
  installs?: number;
  verified?: boolean;
};

export type PairedDevice = {
  id: string;
  name: string;
  platform: string;
  pairedAt: string;
  lastSeenAt?: string;
};

export type PairingToken = {
  token: string;
  uri: string;
  expiresAt: string;
};

export async function getAgents(): Promise<AgentRecord[]> {
  try {
    return await get<AgentRecord[]>('/api/agents');
  } catch {
    return [];
  }
}

export async function getAgent(id: string): Promise<AgentRecord | null> {
  try {
    return await get<AgentRecord>(`/api/agents/${id}`);
  } catch {
    return (await getAgents()).find((agent) => agent.id === id) ?? null;
  }
}

export async function cancelAgent(id: string): Promise<void> {
  await post(`/api/agents/${id}/cancel`, {});
}

export async function getArtifacts(): Promise<ArtifactSummary[]> {
  try {
    return await get<ArtifactSummary[]>('/api/artifacts');
  } catch {
    const { listLocalArtifacts } = await import('./artifacts-store.js');
    return listLocalArtifacts();
  }
}

export async function getArtifact(id: string): Promise<ArtifactSummary | null> {
  try {
    return await get<ArtifactSummary>(`/api/artifacts/${id}`);
  } catch {
    const { getLocalArtifact } = await import('./artifacts-store.js');
    return getLocalArtifact(id);
  }
}

export async function getSkills(): Promise<SkillPack[]> {
  try {
    const data = await get<{ packs?: SkillPack[]; skills?: SkillPack[] }>('/api/skills');
    return data.packs ?? data.skills ?? [];
  } catch {
    const skills = await listSkills();
    return skills.map((skill) => ({
      name: skill.name,
      description: skill.description,
      enabled: true,
    }));
  }
}

export async function installSkill(name: string): Promise<void> {
  await post('/api/skills/install', { name });
}

export async function uninstallSkill(name: string): Promise<void> {
  await post('/api/skills/uninstall', { name });
}

export async function searchHubSkills(query: string): Promise<HubSkill[]> {
  try {
    const data = await get<{ results?: HubSkill[] }>(`/api/hub/skills/search?q=${encodeURIComponent(query)}`);
    return data.results ?? [];
  } catch {
    return [];
  }
}

export async function getPairedDevices(): Promise<PairedDevice[]> {
  try {
    const data = await get<PairedDevice[] | { devices?: PairedDevice[] }>('/api/pair/devices');
    return Array.isArray(data) ? data : (data.devices ?? []);
  } catch {
    return [];
  }
}

export async function generatePairingToken(): Promise<PairingToken> {
  try {
    return await post<PairingToken>('/api/pairing/tokens', {});
  } catch {
    try {
      const code = await post<{ code: string; expiresAt: string }>('/api/pairing/code', {});
      const token = code.code;
      return {
        token,
        expiresAt: code.expiresAt,
        uri: `carina://pair?token=${token}`,
      };
    } catch {
      throw new Error('Pairing unavailable. Run `carina pair` on the gateway host.');
    }
  }
}

export async function revokePairedDevice(id: string): Promise<void> {
  const res = await fetch(`${GATEWAY_BASE}/api/pair/devices/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'X-Carina-Surface': 'desktop' },
  });
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Revoke failed (${res.status})`);
  }
}

export async function getProviders(): Promise<{ providers: string[]; active: string }> {
  return get('/api/providers');
}

export async function switchProvider(provider: string): Promise<void> {
  await post('/api/providers/switch', { provider });
}

export async function testProviderKey(provider: string, apiKey: string): Promise<{ ok: boolean; message?: string }> {
  try {
    return await post('/api/providers/test-key', { provider, apiKey });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Test failed' };
  }
}

export async function saveProviderKey(provider: string, apiKey: string): Promise<void> {
  await post('/api/providers/keys', { provider, apiKey });
}

export async function getChannels(): Promise<Array<{ id: string; name: string; type: string; status: string }>> {
  try {
    return await get('/api/channels');
  } catch {
    return [];
  }
}

export async function openEventsStream(onEvent: (event: unknown) => void): Promise<EventSource> {
  const es = new EventSource(`${GATEWAY_BASE}/api/events/stream`);
  es.onmessage = (ev) => {
    try {
      onEvent(JSON.parse(ev.data));
    } catch {
      onEvent(ev.data);
    }
  };
  for (const type of ['tool', 'agent', 'approval', 'message', 'error'] as const) {
    es.addEventListener(type, (ev) => {
      const messageEvent = ev as MessageEvent<string>;
      try {
        onEvent(JSON.parse(messageEvent.data));
      } catch {
        onEvent({ type, raw: messageEvent.data });
      }
    });
  }
  return es;
}

export async function lspRequest(
  method: string,
  params: unknown,
  options?: { sessionKey?: string; language?: string },
): Promise<unknown> {
  try {
    const data = await post<{ result?: unknown }>('/api/lsp/request', {
      sessionKey: options?.sessionKey,
      method,
      params,
      language: options?.language,
    });
    return data.result ?? null;
  } catch {
    return null;
  }
}

export async function completePairing(token: string): Promise<void> {
  await post('/api/pairing/complete', { token });
}

export type TrustScorePayload = {
  score: number;
  scoutConnected: boolean;
  scoutUrl: string | null;
};

export type SecurityEventPayload = {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  summary: string;
  category?: string;
  at: string;
};

export type KillSwitchPayload = {
  active: boolean;
  reason: string;
  triggeredAt?: string | null;
};

export type BillingPlanPayload = {
  id: string;
  name: string;
  tokenLimit: number | null;
  includedCredits: number | null;
  monthlyPriceGbp: number | null;
};

export type BillingUsagePayload = {
  periodStart: string;
  periodEnd: string;
  tokensUsed: number;
  tokenLimit: number;
  messagesSent: number;
  creditsRemaining: number;
  estimatedCostUsd: number;
  budgetStatus: string;
};

export type BillingSessionPayload = {
  sessionId: string;
  title: string;
  model: string;
  tokens: number;
  estimatedCostUsd: number;
};

export type WorkspacePayload = {
  id: string;
  name: string;
  color: string;
  icon: string;
  sessionCount: number;
};

export type CommitmentPayload = {
  id: string;
  status: string;
  title: string;
  dueAt: string;
  sessionId: string;
  kind?: string;
  sourceSummary?: string;
};

export async function getTrustScore(): Promise<TrustScorePayload> {
  try {
    return await get<TrustScorePayload>('/api/security/trust-score');
  } catch {
    return { score: 72, scoutConnected: false, scoutUrl: null };
  }
}

export async function getSecurityEvents(limit = 5): Promise<SecurityEventPayload[]> {
  try {
    const data = await get<{ events?: SecurityEventPayload[] }>(`/api/security/events?limit=${limit}`);
    return data.events ?? [];
  } catch {
    return [];
  }
}

export async function getKillSwitchStatus(): Promise<KillSwitchPayload> {
  try {
    return await get<KillSwitchPayload>('/api/security/kill-switch-status');
  } catch {
    return { active: false, reason: '' };
  }
}

export async function getBillingPlan(): Promise<BillingPlanPayload> {
  try {
    return await get<BillingPlanPayload>('/api/billing/plan');
  } catch {
    return { id: 'free', name: 'Carina Core', tokenLimit: 100_000, includedCredits: 50_000, monthlyPriceGbp: 0 };
  }
}

export async function getBillingUsage(): Promise<BillingUsagePayload> {
  try {
    return await get<BillingUsagePayload>('/api/billing/usage');
  } catch {
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

export async function getBillingSessions(limit = 5): Promise<BillingSessionPayload[]> {
  try {
    const data = await get<{ sessions?: BillingSessionPayload[] }>(`/api/billing/sessions?limit=${limit}`);
    return data.sessions ?? [];
  } catch {
    return [];
  }
}

export async function getWorkspaces(): Promise<{ workspaces: WorkspacePayload[]; activeId: string }> {
  try {
    return await get('/api/workspaces');
  } catch {
    const { getLocalWorkspaces } = await import('./workspace-store.js');
    return getLocalWorkspaces();
  }
}

export async function createWorkspace(name: string, color: string, icon: string): Promise<WorkspacePayload> {
  try {
    const data = await post<{ workspace: WorkspacePayload }>('/api/workspaces', { name, color, icon });
    return data.workspace;
  } catch {
    const { createLocalWorkspace } = await import('./workspace-store.js');
    return createLocalWorkspace(name, color, icon);
  }
}

export async function switchWorkspace(id: string): Promise<void> {
  try {
    await post('/api/workspaces/active', { id });
  } catch {
    const { switchLocalWorkspace } = await import('./workspace-store.js');
    switchLocalWorkspace(id);
  }
}

export async function deleteWorkspace(id: string): Promise<void> {
  const res = await fetch(`${GATEWAY_BASE}/api/workspaces/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'X-Carina-Surface': 'desktop' },
  });
  if (!res.ok) {
    const { deleteLocalWorkspace } = await import('./workspace-store.js');
    deleteLocalWorkspace(id);
  }
}

export async function getCommitments(): Promise<CommitmentPayload[]> {
  try {
    const data = await get<{ commitments?: CommitmentPayload[] }>('/api/commitments');
    return data.commitments ?? [];
  } catch {
    return [];
  }
}

export async function completeCommitment(id: string): Promise<void> {
  await post(`/api/commitments/${encodeURIComponent(id)}/complete`, {});
}

export async function cancelCommitment(id: string): Promise<void> {
  await post(`/api/commitments/${encodeURIComponent(id)}/cancel`, {});
}

export async function getLearningMetrics(): Promise<{
  skillSuccessRate: number;
  memoriesExtractedWeekly: number;
  preferences: Array<{ preference: string; learnedAt: string }>;
  selfImprovementSkills: string[];
}> {
  try {
    return await get('/api/metrics/learning');
  } catch {
    return { skillSuccessRate: 0, memoriesExtractedWeekly: 0, preferences: [], selfImprovementSkills: [] };
  }
}

export async function getSystemHealth(): Promise<{
  uptimeSeconds: number;
  gatewayStatus: string;
  heapUsedMb: number;
  queueDepth: number;
  suspended: boolean;
}> {
  try {
    return await get('/api/system/health');
  } catch {
    return { uptimeSeconds: 0, gatewayStatus: 'down', heapUsedMb: 0, queueDepth: 0, suspended: false };
  }
}

export async function getOrchestrationAgents(): Promise<Array<{
  id: string;
  name: string;
  status: string;
  task: string;
  startedAt: string;
  parentSessionId?: string;
}>> {
  try {
    const data = await get<{ agents?: Array<{
      id: string;
      name: string;
      status: string;
      task: string;
      startedAt: string;
      parentSessionId?: string;
    }> }>('/api/orchestration/active');
    return data.agents ?? [];
  } catch {
    return [];
  }
}

export async function runBenchmark(): Promise<void> {
  await post('/api/benchmarks/run', {});
}
