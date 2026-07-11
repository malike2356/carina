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
    n8n: IntegrationStatus;
    resend: IntegrationStatus;
    caldav: IntegrationStatus;
    'google-workspace': IntegrationStatus;
    webhooks: IntegrationStatus;
  },
): IntegrationStatus {
  if (item.statusKey === 'trello') return resolved.trello;
  if (item.statusKey === 'calendar') return resolved.calendar;
  if (item.statusKey === 'pairing') return resolved.pairing;
  if (item.statusKey === 'n8n') return resolved.n8n;
  if (item.statusKey === 'resend') return resolved.resend;
  if (item.statusKey === 'caldav') return resolved.caldav;
  if (item.statusKey === 'google-workspace') return resolved['google-workspace'];
  if (item.statusKey === 'webhooks') return resolved.webhooks;

  if (item.statusKey?.startsWith('aiva:')) {
    if (aiva.proxyError) return 'unknown';
    const channelType = item.statusKey.slice('aiva:'.length);
    return aivaChannelStatus(channelType, aiva.workers, aiva.channelsByWorker);
  }

  return 'unknown';
}

async function loadConversationalChannelMap(
  workspaceId: string,
): Promise<Map<string, { configured: boolean; status: string }>> {
  const map = new Map<string, { configured: boolean; status: string }>();
  if (!coreProxyEnabled()) return map;

  try {
    const res = await proxyAivaRequest(workspaceId, '/api/channels/overview');
    if (!res.ok) return map;
    const data = (await res.json()) as {
      channels?: Array<{ id: string; configured?: boolean; status?: string }>;
    };
    for (const ch of data.channels ?? []) {
      map.set(ch.id, {
        configured: Boolean(ch.configured),
        status: ch.status ?? (ch.configured ? 'configured' : 'not_configured'),
      });
    }
  } catch {
    // fall through; worker statuses still apply
  }
  return map;
}

function conversationalStatusForItem(
  item: IntegrationDef,
  conversational: Map<string, { configured: boolean; status: string }>,
): IntegrationStatus | null {
  const channelType = item.aivaChannelType ?? item.statusKey?.replace(/^aiva:/, '');
  if (!channelType) return null;

  // Map Cloud catalog types onto conversational registry ids
  const candidates = [channelType];
  if (channelType === 'whatsapp') candidates.push('whatsapp_cloud', 'whatsapp');
  if (channelType === 'email') candidates.push('email');

  for (const id of candidates) {
    const row = conversational.get(id);
    if (row?.configured && row.status !== 'error') return 'connected';
    if (row?.status === 'error') return 'partial';
  }
  return null;
}

async function loadCoreSettingsStatuses(
  workspaceId: string,
): Promise<Map<string, IntegrationStatus>> {
  const map = new Map<string, IntegrationStatus>();
  if (!coreProxyEnabled()) return map;

  try {
    const res = await proxyAivaRequest(workspaceId, '/api/internal/settings/overview');
    if (!res.ok) return map;
    const data = (await res.json()) as {
      categories?: Array<{
        category: string;
        domains: Array<{ id: string; configured: boolean }>;
      }>;
    };
    for (const cat of data.categories ?? []) {
      for (const domain of cat.domains) {
        map.set(domain.id, domain.configured ? 'connected' : 'not_connected');
      }
    }
  } catch {
    // unavailable - fall through to 'unknown'
  }
  return map;
}

export async function loadIntegrationStatuses(workspaceId: string): Promise<IntegrationStatusMap> {
  const [aiva, trello, calendar, pairing, conversational, coreSettings] = await Promise.all([
    loadAivaChannelMap(workspaceId),
    trelloStatus(workspaceId),
    calendarStatus(workspaceId),
    pairingStatus(),
    loadConversationalChannelMap(workspaceId),
    loadCoreSettingsStatuses(workspaceId),
  ]);

  // Derive integration:* statuses from core settings overview
  const settingsN8n = coreSettings.get('integration:n8n') ?? 'unknown';
  const settingsResend = coreSettings.get('integration:resend') ?? 'unknown';
  const settingsCalDav = coreSettings.get('integration:caldav') ?? 'unknown';
  // Prefer trello from dedicated API; fall back to settings store
  const resolvedTrello =
    trello !== 'unknown' ? trello : (coreSettings.get('integration:trello') ?? 'unknown');

  const resolved = {
    trello: resolvedTrello,
    calendar,
    pairing,
    n8n: settingsN8n,
    resend: settingsResend,
    caldav: settingsCalDav,
    'google-workspace': coreSettings.get('integration:google-workspace') ?? 'unknown',
    webhooks: coreSettings.get('integration:webhooks') ?? 'unknown',
  };
  const statuses: IntegrationStatusMap = {};

  for (const item of INTEGRATION_CATALOG) {
    const fromWorker = statusForItem(item, aiva, resolved);
    const fromConversational = conversationalStatusForItem(item, conversational);
    if (fromWorker === 'connected' || fromConversational === 'connected') {
      statuses[item.slug] = 'connected';
    } else if (fromConversational === 'partial' || fromWorker === 'partial') {
      statuses[item.slug] = 'partial';
    } else {
      statuses[item.slug] = fromWorker;
    }
  }

  return statuses;
}
