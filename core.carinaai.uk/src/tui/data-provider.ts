import { browseRecentSessions } from '../memory/session-index.js';
import { listSubagentMetrics } from '../telemetry/subagent-metrics.js';
import { listJobs } from '../agents/cron-scheduler.js';
import { listProcesses } from '../tools/process-registry.js';
import { listTaskFlowRuns, listDeliveryQueue, taskFlowsEnabled } from '../ops/taskflows/index.js';
import { registry } from '../tools/index.js';
import { getActiveProfileOrDefault, operatorMemoryScope } from '../profiles/isolation.js';

export interface SessionRow {
  sessionId: string;
  title: string;
  lastAt: string;
}

export interface TaskRow {
  kind: string;
  id: string;
  status: string;
  detail: string;
  flowId?: string;
}

export interface ProcessRow {
  sessionId: string;
  pid: number;
  status: string;
  command: string;
  uptime: number;
}

export interface ToolRow {
  name: string;
  dangerous: boolean;
}

export interface TuiSnapshot {
  activeProfile: string;
  sessions: SessionRow[];
  tasks: TaskRow[];
  processes: ProcessRow[];
  tools: ToolRow[];
  memoryReady: boolean;
}

export async function loadTuiSnapshot(memoryReady: boolean): Promise<TuiSnapshot> {
  const activeProfile = getActiveProfileOrDefault();
  const memoryScope = operatorMemoryScope(activeProfile);
  const sessions: SessionRow[] = [];
  if (memoryReady) {
    try {
      const hits = await browseRecentSessions(40, memoryScope);
      for (const hit of hits) {
        sessions.push({
          sessionId: hit.sessionId,
          title: hit.title || hit.sessionId,
          lastAt: hit.timestamp?.toISOString?.()?.slice(0, 19) ?? '',
        });
      }
    } catch {
      // memory unavailable
    }
  }

  const tasks: TaskRow[] = [];
  for (const p of listProcesses()) {
    tasks.push({
      kind: 'process',
      id: p.session_id,
      status: p.status,
      detail: `pid=${p.pid} ${p.command}`,
    });
  }
  try {
    const jobs = await listJobs();
    for (const j of jobs) {
      tasks.push({
        kind: 'cron',
        id: j.id,
        status: j.status,
        detail: `${j.schedule} ${j.name ?? ''}`.trim(),
      });
    }
  } catch {
    // cron unavailable
  }
  if (taskFlowsEnabled()) {
    for (const r of listTaskFlowRuns(20)) {
      tasks.push({
        kind: 'taskflow',
        id: r.id,
        flowId: r.flowId,
        status: r.status,
        detail: r.flowName,
      });
    }
    for (const d of listDeliveryQueue()) {
      tasks.push({
        kind: 'delivery',
        id: d.id,
        status: d.status,
        detail: d.channel,
      });
    }
  }
  for (const row of listSubagentMetrics(12)) {
    tasks.push({
      kind: 'subagent',
      id: row.sessionId,
      status: row.status,
      detail: `${row.agentType}${row.latencyMs != null ? ` ${row.latencyMs}ms` : ''}`,
    });
  }

  const processes: ProcessRow[] = listProcesses().map((p) => ({
    sessionId: p.session_id,
    pid: p.pid,
    status: p.status,
    command: p.command,
    uptime: p.uptime,
  }));

  const tools: ToolRow[] = registry.list().map((t) => ({
    name: t.name,
    dangerous: Boolean(t.dangerous),
  })).sort((a, b) => a.name.localeCompare(b.name));

  return { activeProfile, sessions, tasks, processes, tools, memoryReady };
}
