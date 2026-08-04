import { listWorkers } from '../workers/worker-store.js';
import { listWorkerChannelDetails, readChannelCredentials } from '../channels/channel-store.js';
import { getAdapter } from '../channels/adapter-registry.js';
import type { OutreachAlertTarget } from './types.js';
import { loadOutreachStore, mutateOutreachStore } from './store.js';

function nowIso(): string {
  return new Date().toISOString();
}

function defaultWorkspaceTarget(workspaceId: string): OutreachAlertTarget {
  return {
    workspaceId,
    enabled: false,
    channel: 'telegram',
    conversationId: '',
    updatedAt: nowIso(),
  };
}

export function getOutreachAlertTarget(workspaceId: string): OutreachAlertTarget {
  return loadOutreachStore().alertTargets[workspaceId] ?? defaultWorkspaceTarget(workspaceId);
}

export function updateOutreachAlertTarget(workspaceId: string, patch: Partial<Omit<OutreachAlertTarget, 'workspaceId' | 'updatedAt'>>): OutreachAlertTarget {
  const current = getOutreachAlertTarget(workspaceId);
  const next: OutreachAlertTarget = {
    ...current,
    ...patch,
    workspaceId,
    enabled: patch.enabled ?? current.enabled,
    channel: patch.channel ?? current.channel,
    conversationId: patch.conversationId !== undefined ? patch.conversationId.trim() : current.conversationId,
    workerId: patch.workerId !== undefined ? patch.workerId?.trim() || undefined : current.workerId,
    label: patch.label !== undefined ? patch.label?.trim() || undefined : current.label,
    updatedAt: nowIso(),
  };
  mutateOutreachStore((store) => {
    store.alertTargets[workspaceId] = next;
  });
  return next;
}

async function resolveTelegramDeliveryContext(workspaceId: string, workerId?: string): Promise<{
  workerId: string;
  botToken: string;
} | null> {
  const workers = await listWorkers(workspaceId);
  for (const worker of workerId ? workers.filter((row) => row.id === workerId) : workers) {
    if (!worker) continue;
    const channels = await listWorkerChannelDetails(worker.id);
    const telegram = channels.find((row) => row.channel === 'telegram' && row.enabled);
    if (!telegram) continue;
    const credentials = readChannelCredentials(telegram);
    const botToken = credentials.bot_token ?? credentials.token;
    if (!botToken) continue;
    return { workerId: worker.id, botToken };
  }
  return null;
}

export async function sendOutreachTelegramAlert(input: {
  workspaceId: string;
  title: string;
  message: string;
  workerId?: string;
}): Promise<{ ok: boolean; sent?: true; error?: string; skipped?: string }> {
  const target = getOutreachAlertTarget(input.workspaceId);
  if (!target.enabled || target.channel !== 'telegram' || !target.conversationId.trim()) {
    return { ok: false, skipped: 'telegram_alert_target_not_configured' };
  }
  const delivery = await resolveTelegramDeliveryContext(input.workspaceId, target.workerId ?? input.workerId);
  if (!delivery) {
    return { ok: false, skipped: 'telegram_channel_not_connected' };
  }
  const adapter = getAdapter('telegram');
  if (!adapter) {
    return { ok: false, error: 'Telegram adapter is not available' };
  }
  const text = [
    input.title.trim(),
    '',
    input.message.trim(),
    '',
    `Workspace: ${input.workspaceId}`,
  ].join('\n');
  try {
    await adapter.send(
      {
        channel: 'telegram',
        contactId: target.conversationId.trim(),
        content: text,
      },
      { bot_token: delivery.botToken },
    );
    return { ok: true, sent: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function outreachAlertTargetSummary(target: OutreachAlertTarget): string {
  if (!target.enabled) return 'Telegram alerts disabled';
  if (!target.conversationId.trim()) return 'Telegram alert target missing conversation id';
  return `Telegram alerts enabled for ${target.label ?? target.conversationId}`;
}
