export interface AgentStatusRow {
  id: string;
  name: string;
  status: string;
  suspension_reason: string | null;
  last_heartbeat: Date | string | null;
}

export interface AgentStatusSummary {
  total: number;
  active: number;
  suspended: number;
  offline: number;
  agents: Array<{
    id: string;
    name: string;
    status: 'active' | 'suspended' | 'offline';
    secondsAgo: number | null;
    suspensionReason: string | null;
  }>;
}

type NormalizedAgentStatus = AgentStatusSummary['agents'][number]['status'];

export function buildAgentStatus(rows: AgentStatusRow[], now = Date.now()): AgentStatusSummary {
  const agents = rows.map((row) => {
    const last = row.last_heartbeat ? new Date(row.last_heartbeat).getTime() : null;
    const secondsAgo = last === null ? null : Math.max(0, Math.floor((now - last) / 1000));
    const status: NormalizedAgentStatus = row.status === 'suspended'
      ? 'suspended'
      : secondsAgo === null || secondsAgo > 90
        ? 'offline'
        : 'active';
    return {
      id: row.id,
      name: row.name,
      status,
      secondsAgo,
      suspensionReason: row.suspension_reason,
    };
  });

  return {
    total: agents.length,
    active: agents.filter((agent) => agent.status === 'active').length,
    suspended: agents.filter((agent) => agent.status === 'suspended').length,
    offline: agents.filter((agent) => agent.status === 'offline').length,
    agents,
  };
}
