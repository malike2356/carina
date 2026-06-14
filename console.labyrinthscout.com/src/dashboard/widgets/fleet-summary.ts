import { buildAgentStatus, type AgentStatusRow } from './agent-status.js';

export interface FleetAgent {
  id: string;
  name: string;
  status: 'active' | 'suspended' | 'offline';
  secondsAgo: number | null;
  suspensionReason: string | null;
  events24h: { critical: number; warning: number; info: number; breach: number };
}

export interface FleetSummary {
  total: number;
  active: number;
  suspended: number;
  offline: number;
  fleet: FleetAgent[];
}

export interface FleetEventCountRow {
  instance_id: string;
  severity: string;
  count: string;
}

export function buildFleetSummary(
  agentRows: AgentStatusRow[],
  eventRows: FleetEventCountRow[],
  now = Date.now(),
): FleetSummary {
  const countsByInstance = new Map<string, Record<string, number>>();
  for (const row of eventRows) {
    if (!row.instance_id) continue;
    const map = countsByInstance.get(row.instance_id) ?? {};
    map[row.severity] = Number(row.count);
    countsByInstance.set(row.instance_id, map);
  }

  const agents = buildAgentStatus(agentRows, now);
  const fleet = agents.agents.map((agent) => {
    const counts = countsByInstance.get(agent.id) ?? {};
    return {
      ...agent,
      events24h: {
        critical: counts['critical'] ?? 0,
        warning: counts['warning'] ?? 0,
        info: counts['info'] ?? 0,
        breach: counts['breach'] ?? 0,
      },
    };
  });

  return {
    total: agents.total,
    active: agents.active,
    suspended: agents.suspended,
    offline: agents.offline,
    fleet,
  };
}
