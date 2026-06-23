import { config } from '../config/index.js';
import { reportEvent } from './scout-client.js';

export interface DeceptionState {
  augmentation: string;
  currentMarker: string;
  previousMarkers: Array<{ value: string; rotated_at: string }>;
}

let cached: DeceptionState | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60_000;

function isEnabled(): boolean {
  return (
    process.env.LABYRINTH_ENABLED === 'true' &&
    config.labyrinth.url !== '' &&
    config.labyrinth.apiKey !== ''
  );
}

async function fetchDeceptionState(instanceId: string): Promise<DeceptionState | null> {
  if (!isEnabled()) return null;

  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL_MS) {
    return cached;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const url = new URL(`${config.labyrinth.url.replace(/\/+$/, '')}/api/deception/augmentation`);
    url.searchParams.set('instance_id', instanceId);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'X-Scout-Key': config.labyrinth.apiKey },
      signal: controller.signal,
    });
    if (!res.ok) return cached;

    const data = (await res.json()) as {
      augmentation?: string;
      current_marker?: string;
      previous_markers?: Array<{ value: string; rotated_at: string }>;
    };

    const state: DeceptionState = {
      augmentation: typeof data.augmentation === 'string' ? data.augmentation : '',
      currentMarker: typeof data.current_marker === 'string' ? data.current_marker : '',
      previousMarkers: Array.isArray(data.previous_markers) ? data.previous_markers : [],
    };

    cached = state;
    cachedAt = now;
    return state;
  } catch {
    return cached;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getDeceptionAugmentation(instanceId?: string): Promise<string> {
  const id = instanceId ?? config.labyrinth.instanceId;
  const state = await fetchDeceptionState(id);
  return state?.augmentation ?? '';
}

/**
 * Detects stale rotation markers in user input (attackers replaying old prompt tokens).
 */
export async function checkStaleMarkerInput(
  message: string,
  instanceId?: string,
): Promise<{ blocked: boolean; reason?: string }> {
  if (!isEnabled() || !message.trim()) return { blocked: false };

  const id = instanceId ?? config.labyrinth.instanceId;
  const state = await fetchDeceptionState(id);
  if (!state?.currentMarker) return { blocked: false };

  if (message.includes(state.currentMarker)) {
    return { blocked: false };
  }

  for (let i = 0; i < state.previousMarkers.length; i++) {
    const marker = state.previousMarkers[i]!;
    if (message.includes(marker.value) && i >= 1) {
      await reportEvent({
        severity: 'critical',
        source: 'deception',
        event_type: 'stale_marker_detected',
        description: `Stale deception marker detected in user input (rotation index ${i + 1})`,
        metadata: { marker_preview: marker.value.slice(0, 12), rotation_index: i + 1 },
        instance_id: id,
      });
      return {
        blocked: true,
        reason: 'This message contains a retired security marker and was blocked.',
      };
    }
  }

  return { blocked: false };
}

/** Reset deception cache (tests only). */
export function _resetDeceptionCache(): void {
  cached = null;
  cachedAt = 0;
}
