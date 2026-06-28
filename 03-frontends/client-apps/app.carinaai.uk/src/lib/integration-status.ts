import {
  INTEGRATION_CATALOG,
  type IntegrationDef,
} from '@/lib/integration-catalog';
import {
  getWorkspaceCalendarConnection,
  isCalendarConnectionConfigured,
  toConnectionView,
} from '@/lib/calendar-connection';
import { coreProxyEnabled } from '@/lib/core-proxy';
import { proxyAivaRequest } from '@/lib/aiva-proxy';
import { listPairingDevices } from '@/lib/pairing';

export type IntegrationStatus = 'connected' | 'partial' | 'not_connected' | 'unknown';

export type IntegrationStatusMap = Record<string, IntegrationStatus>;

type WorkerRef = { id: string };
type ChannelRef = { type: string; connected?: boolean };

async function loadAivaChannelMap(workspaceId: string): Promise<{
  workers: WorkerRef[];
  channelsByWorker: Map<string, ChannelRef[]>;
  proxyError: boolean;
}> {
  if (!coreProxyEnabled()) {
    return { workers: [], channelsByWorker: new Map(), proxyError: true };
  }

  const workersRes = await proxyAivaRequest(workspaceId, '/api/aiva/workers');
  if (!workersRes.ok) {
    return { workers: [], channelsByWorker: new Map(), proxyError: true };
  }

  const workersData = (await workersRes.json()) as { workers?: WorkerRef[] };
  const workers = workersData.workers ?? [];
  if (workers.length === 0) {
    return { workers: [], channelsByWorker: new Map(), proxyError: false };
  }

  const channelEntries = await Promise.all(
    workers.map(async (worker) => {
      const channelsRes = await proxyAivaRequest(
        workspaceId,
        `/api/aiva/workers/${worker.id}/channels`,
      );
      if (!channelsRes.ok) {
        return [worker.id, [] as ChannelRef[]] as const;
      }
      const channelsData = (await channelsRes.json()) as { channels?: ChannelRef[] };
      return [worker.id, channelsData.channels ?? []] as const;
    }),
  );

  return {
    workers,
    channelsByWorker: new Map(channelEntries),
    proxyError: false,
  };
}

function aivaChannelStatus(
  channelType: string,
  workers: WorkerRef[],
  channelsByWorker: Map<string, ChannelRef[]>,
): IntegrationStatus {
  if (workers.length === 0) return 'not_connected';

  let connected = 0;
  for (const worker of workers) {
    const channels = channelsByWorker.get(worker.id) ?? [];
    const match = channels.find((ch) => ch.type === channelType);
    if (match?.connected) connected += 1;
  }

  if (connected === 0) return 'not_connected';
  if (connected === workers.length) return 'connected';
  return 'partial';
}

async function trelloStatus(workspaceId: string): Promise<IntegrationStatus> {
  if (!coreProxyEnabled()) return 'unknown';

  const res = await proxyAivaRequest(workspaceId, '/api/trello/settings');
  if (!res.ok) return 'unknown';

  const data = (await res.json()) as { configured?: boolean };
  return data.configured ? 'connected' : 'not_connected';
}

async function calendarStatus(workspaceId: string): Promise<IntegrationStatus> {
  const connection = await getWorkspaceCalendarConnection(workspaceId);
  const view = connection ? toConnectionView(connection) : null;
  return isCalendarConnectionConfigured(view) ? 'connected' : 'not_connected';
}

async function pairingStatus(): Promise<IntegrationStatus> {
  if (!coreProxyEnabled()) return 'unknown';

  try {
    const devices = await listPairingDevices();
    return devices.length > 0 ? 'connected' : 'not_connected';
  } catch {
    return 'unknown';
  }
}

function statusForItem(
  item: IntegrationDef,
  aiva: {
    workers: WorkerRef[];
    channelsByWorker: Map<string, ChannelRef[]>;
    proxyError: boolean;
  },
  resolved: {
    trello: IntegrationStatus;
    calendar: IntegrationStatus;
    pairing: IntegrationStatus;
  },
): IntegrationStatus {
  if (item.statusKey === 'trello') return resolved.trello;
  if (item.statusKey === 'calendar') return resolved.calendar;
  if (item.statusKey === 'pairing') return resolved.pairing;

  if (item.statusKey?.startsWith('aiva:')) {
    if (aiva.proxyError) return 'unknown';
    const channelType = item.statusKey.slice('aiva:'.length);
    return aivaChannelStatus(channelType, aiva.workers, aiva.channelsByWorker);
  }

  return 'unknown';
}

export async function loadIntegrationStatuses(workspaceId: string): Promise<IntegrationStatusMap> {
  const [aiva, trello, calendar, pairing] = await Promise.all([
    loadAivaChannelMap(workspaceId),
    trelloStatus(workspaceId),
    calendarStatus(workspaceId),
    pairingStatus(),
  ]);

  const resolved = { trello, calendar, pairing };
  const statuses: IntegrationStatusMap = {};

  for (const item of INTEGRATION_CATALOG) {
    statuses[item.slug] = statusForItem(item, aiva, resolved);
  }

  return statuses;
}
