import { config } from '../config/index.js';
import { pool } from '../memory/db.js';
import { reportEvent } from '../security/scout-client.js';
import type { ActivityEntry, Worker } from '../types/index.js';

const fleetEnabled = (): boolean =>
  process.env.AIVA_SCOUT_FLEET_ENABLED !== 'false' && config.labyrinth.enabled;

const attestEnabled = (): boolean =>
  process.env.AIVA_CHAIN_ATTEST_ENABLED !== 'false' && config.labyrinth.enabled;

function publicCoreUrl(): string {
  return config.product.coreUrl;
}

async function postToScout(path: string, body: unknown): Promise<Response | null> {
  if (!config.labyrinth.url) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    return await fetch(`${config.labyrinth.url.replace(/\/+$/, '')}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Scout-Key': config.labyrinth.apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function registerAivaAgent(worker: Worker): Promise<void> {
  if (!fleetEnabled()) return;
  const analyticsUrl = `${publicCoreUrl()}/api/aiva/workers/${worker.id}/analytics`;
  await postToScout('/api/events', {
    instance_id: worker.id,
    event_type: 'aiva_fleet_register',
    severity: 'info',
    source: 'aiva-brain',
    description: `Aiva registered: ${worker.name}`,
    metadata: {
      agentId: worker.id,
      name: worker.name,
      type: 'aiva',
      workspaceId: worker.workspaceId,
      analyticsUrl,
      roleDescription: worker.roleDescription,
      templateId: worker.templateId,
      channels: worker.channels,
      skillPacks: worker.skillPacks,
    },
  });
}

export async function updateAivaAgentStatus(agentId: string, status: string): Promise<void> {
  if (!fleetEnabled()) return;
  await reportEvent({
    severity: 'info',
    source: 'aiva-brain',
    event_type: 'aiva_status_update',
    description: `Aiva status: ${status}`,
    metadata: { agentId, status },
    instance_id: agentId,
  });
}

export async function reportAivaEvent(input: {
  agentId: string;
  eventType: string;
  severity: 'info' | 'warning' | 'critical';
  summary: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!fleetEnabled()) return;
  await reportEvent({
    severity: input.severity,
    source: 'aiva-brain',
    event_type: input.eventType,
    description: input.summary,
    metadata: input.metadata,
    instance_id: input.agentId,
  });
}

export async function attestActivity(activity: ActivityEntry, digest: string): Promise<void> {
  if (!attestEnabled()) return;
  let txHash: string | null = null;

  const res = await postToScout('/api/trust/attest', {
    label: 'AivaAction',
    agentId: activity.workerId,
    digest,
    timestamp: activity.createdAt.toISOString(),
  });

  if (res?.ok) {
    const body = await res.json().catch(() => ({})) as { tx_hash?: string; txHash?: string };
    txHash = body.tx_hash ?? body.txHash ?? null;
  }

  if (!txHash) {
    txHash = `digest:${digest.slice(0, 32)}`;
  }

  await pool.query('UPDATE ai_worker_activity SET attestation_tx = $1 WHERE id = $2', [txHash, activity.id]);
}

const directiveCache = new Map<string, { suspended: boolean; checkedAt: number }>();

export async function getAgentDirective(agentId: string): Promise<{ paused: boolean }> {
  const cached = directiveCache.get(agentId);
  if (cached && Date.now() - cached.checkedAt < 30_000) {
    return { paused: cached.suspended };
  }

  if (!config.labyrinth.url) return { paused: false };

  try {
    const res = await fetch(
      `${config.labyrinth.url.replace(/\/+$/, '')}/api/instances/${encodeURIComponent(agentId)}/status`,
      {
        headers: { 'X-Scout-Key': config.labyrinth.apiKey },
        signal: AbortSignal.timeout(2000),
      },
    );
    if (!res.ok) return { paused: false };
    const body = await res.json() as { suspended?: boolean };
    const suspended = body.suspended === true;
    directiveCache.set(agentId, { suspended, checkedAt: Date.now() });
    return { paused: suspended };
  } catch {
    return { paused: false };
  }
}
