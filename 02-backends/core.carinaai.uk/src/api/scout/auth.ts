import type { Request } from 'express';
import { config } from '../../config/index.js';
import { isControlAuthorized } from '../../infrastructure/control-auth.js';
import { isScoutAgenticLayerEnabled } from '../../security/scout/scout-agentic-guard.js';

function resolveInternalKey(): string {
  return (
    process.env.CARINA_INTERNAL_KEY?.trim()
    || process.env.CARINA_CLOUD_INTERNAL_KEY?.trim()
    || ''
  );
}

export function isScoutAgenticApiAuthorized(req: Request): boolean {
  if (!isScoutAgenticLayerEnabled()) return false;
  if (isControlAuthorized(req)) return true;

  const scoutKey = String(req.headers['x-scout-key'] ?? '').trim();
  if (scoutKey && config.labyrinth.apiKey && scoutKey === config.labyrinth.apiKey) {
    return true;
  }

  const internal = resolveInternalKey();
  if (internal && String(req.headers['x-internal-key'] ?? '').trim() === internal) {
    return true;
  }

  return false;
}

export function scoutAgenticDisabledResponse(): { status: number; body: Record<string, unknown> } {
  if (!isScoutAgenticLayerEnabled()) {
    return { status: 503, body: { error: 'Scout agentic layer is disabled (SCOUT_ENABLED=false or carina_only mode)' } };
  }
  return { status: 401, body: { error: 'Unauthorized' } };
}
