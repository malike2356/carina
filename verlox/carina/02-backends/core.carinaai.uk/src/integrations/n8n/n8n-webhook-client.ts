import { pool } from '../../memory/db.js';
import { buildIlaudN8nPayload, resolveN8nWebhookUrl } from './ilaud-event-map.js';
import { isN8nIlaudConfigured, resolveN8nIlaudConfig } from './config.js';

async function isWorkerN8nEmitAllowed(workerId: string): Promise<boolean> {
  const result = await pool.query('SELECT status FROM ai_workers WHERE id = $1 LIMIT 1', [workerId]);
  const status = String(result.rows[0]?.status ?? '');
  return status === 'active';
}

export async function emitIlaudN8nEvent(input: {
  eventType: string;
  workspaceId: string;
  workerId: string;
  description?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ sent: boolean; skipped?: string }> {
  if (!isN8nIlaudConfigured()) {
    return { sent: false, skipped: 'n8n_not_configured' };
  }

  if (!await isWorkerN8nEmitAllowed(input.workerId)) {
    return { sent: false, skipped: 'worker_not_active' };
  }

  const config = resolveN8nIlaudConfig();
  const payload = buildIlaudN8nPayload({
    eventType: input.eventType,
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    config,
    metadata: input.metadata,
    description: input.description,
  });
  if (!payload) {
    return { sent: false, skipped: 'event_not_mapped' };
  }

  const url = resolveN8nWebhookUrl(input.eventType, config);
  if (!url) {
    return { sent: false, skipped: 'webhook_url_missing' };
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.webhookSecret) {
    headers['X-Carina-N8n-Secret'] = config.webhookSecret;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });

  if (response.status === 429) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const retry = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (!retry.ok) {
      console.warn(`[n8n-ilaud] webhook retry failed with HTTP ${retry.status}`);
      return { sent: false, skipped: `http_${retry.status}` };
    }
    return { sent: true };
  }

  if (!response.ok) {
    console.warn(`[n8n-ilaud] webhook failed with HTTP ${response.status} for ${input.eventType}`);
    return { sent: false, skipped: `http_${response.status}` };
  }

  return { sent: true };
}
