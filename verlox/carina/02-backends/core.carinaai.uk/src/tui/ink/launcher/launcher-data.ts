import { buildEntranceSnapshot } from '../../../cli/entrance.js';
import { browseRecentSessions } from '../../../memory/session-index.js';
import { collectSurfaceRuntimeSnapshot } from '../../../product/surface-capabilities.js';
import { registry } from '../../../tools/index.js';
import { listProcesses } from '../../../tools/process-registry.js';

export interface TuiLauncherStatus {
  model: string;
  memory: string;
  scout: string;
  channels: string;
  skills: string;
  latency: string;
  sessions: string;
  uptime: string;
}

export interface TuiLauncherProject {
  id: string;
  name: string;
  lastActivityAgo: string;
}

function formatUptime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatAgo(date: Date | null | undefined): string {
  if (!date) return 'just now';
  const diff = Date.now() - new Date(date).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d !== 1 ? 's' : ''} ago`;
}

export async function loadTuiLauncherData(memoryReady = true): Promise<{
  status: TuiLauncherStatus;
  projects: TuiLauncherProject[];
}> {
  const entrance = buildEntranceSnapshot({
    surface: 'cli',
    memoryReady,
    toolCount: registry.list().length,
  });
  const runtime = collectSurfaceRuntimeSnapshot();
  const processes = listProcesses();

  let memoryLabel = 'local';
  if (!memoryReady) memoryLabel = 'offline';
  else if (!runtime.memoryEnabled) memoryLabel = 'none';

  const projects: TuiLauncherProject[] = [];
  if (memoryReady) {
    try {
      const hits = await browseRecentSessions(5);
      for (const hit of hits) {
        projects.push({
          id: hit.sessionId,
          name: hit.title || hit.sessionId,
          lastActivityAgo: formatAgo(hit.timestamp),
        });
      }
    } catch {
      // memory unavailable
    }
  }

  return {
    status: {
      model: `${entrance.provider}/${entrance.model}`,
      memory: memoryLabel,
      scout: entrance.scoutSecured ? 'protected' : 'not paired',
      channels: `${runtime.configuredChannels.length} active`,
      skills: `${runtime.activeSkillPacks.length} loaded`,
      latency: '< 200ms',
      sessions: `${processes.length} running`,
      uptime: formatUptime(process.uptime()),
    },
    projects,
  };
}
