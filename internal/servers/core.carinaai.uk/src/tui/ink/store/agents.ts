import { listSubagentMetrics } from '../../../telemetry/subagent-metrics.js';
import { cancelSubagent as cancelRegisteredSubagent } from '../../../agents/subagent-cancel-registry.js';

export interface ActiveAgent {
  id: string;
  sessionId: string;
  agentType: string;
  name: string;
  task: string;
  status: 'running' | 'waiting' | 'complete' | 'failed';
  startedAt: number;
  currentTool?: string;
}

type AgentListener = (agents: ActiveAgent[]) => void;

let agents: ActiveAgent[] = [];
const listeners = new Set<AgentListener>();
let pollTimer: ReturnType<typeof setInterval> | null = null;

function mapMetricStatus(status: string): ActiveAgent['status'] {
  switch (status) {
    case 'started': return 'running';
    case 'completed': return 'complete';
    case 'failed': return 'failed';
    case 'cancelled': return 'failed';
    default: return 'waiting';
  }
}

export function syncAgentsFromMetrics(): ActiveAgent[] {
  const metrics = listSubagentMetrics(100);
  const latest = new Map<string, (typeof metrics)[number]>();

  for (const m of metrics) {
    const key = `${m.sessionId}:${m.agentType}`;
    if (!latest.has(key)) latest.set(key, m);
  }

  const next: ActiveAgent[] = [];
  for (const m of latest.values()) {
    const status = mapMetricStatus(m.status);
    if (status !== 'running' && status !== 'waiting') continue;
    next.push({
      id: `${m.sessionId}:${m.agentType}:${m.ts}`,
      sessionId: m.sessionId,
      agentType: m.agentType,
      name: m.agentType,
      task: `${m.agentType} subagent`,
      status,
      startedAt: new Date(m.ts).getTime(),
    });
  }

  agents = next;
  for (const listener of listeners) listener(agents);
  return agents;
}

export function subscribeAgents(listener: AgentListener): () => void {
  listeners.add(listener);
  listener(agents);
  return () => listeners.delete(listener);
}

export function getActiveAgents(): ActiveAgent[] {
  return agents;
}

export function startAgentPolling(intervalMs = 1000): void {
  if (pollTimer) return;
  syncAgentsFromMetrics();
  pollTimer = setInterval(() => syncAgentsFromMetrics(), intervalMs);
}

export function stopAgentPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export function cancelActiveAgent(agent: ActiveAgent): boolean {
  const ok = cancelRegisteredSubagent(agent.sessionId, agent.agentType);
  if (ok) syncAgentsFromMetrics();
  return ok;
}
