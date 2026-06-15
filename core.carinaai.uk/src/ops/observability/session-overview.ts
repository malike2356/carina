import { listAcpSessions } from '../../infrastructure/acp-bridge/store.js';
import { readTurnLogs } from '../../telemetry/turn-log.js';

export type AgentSessionStatus = 'active' | 'idle' | 'stale';

export type AgentSessionOverview = {
  sessionId: string;
  source: 'acp' | 'gateway';
  label?: string;
  provenance?: string;
  lastActivityAt: string;
  status: AgentSessionStatus;
  profile?: string;
  platform?: string;
  turnCount?: number;
};

const ACTIVE_MS = 10 * 60 * 1000;
const IDLE_MS = 60 * 60 * 1000;

function classifyStatus(lastActivityAt: string): AgentSessionStatus {
  const age = Date.now() - new Date(lastActivityAt).getTime();
  if (age < ACTIVE_MS) return 'active';
  if (age < IDLE_MS) return 'idle';
  return 'stale';
}

export async function buildSessionOverview(): Promise<AgentSessionOverview[]> {
  const bySession = new Map<string, AgentSessionOverview>();

  for (const session of listAcpSessions()) {
    bySession.set(session.sessionId, {
      sessionId: session.sessionId,
      source: 'acp',
      label: session.label,
      provenance: session.provenance,
      lastActivityAt: session.lastUsed,
      status: classifyStatus(session.lastUsed),
    });
  }

  const turns = await readTurnLogs({ limit: 200 });
  for (const turn of turns) {
    const existing = bySession.get(turn.sessionId);
    if (existing) {
      existing.turnCount = (existing.turnCount ?? 0) + 1;
      if (turn.ts > existing.lastActivityAt) {
        existing.lastActivityAt = turn.ts;
        existing.status = classifyStatus(turn.ts);
        existing.profile = turn.profile;
        existing.platform = turn.platform;
      }
      continue;
    }
    bySession.set(turn.sessionId, {
      sessionId: turn.sessionId,
      source: 'gateway',
      lastActivityAt: turn.ts,
      status: classifyStatus(turn.ts),
      profile: turn.profile,
      platform: turn.platform,
      turnCount: 1,
    });
  }

  return [...bySession.values()].sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
}
