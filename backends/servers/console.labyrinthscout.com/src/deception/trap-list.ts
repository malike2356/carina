import { movingTarget } from './moving-target.js';
import { honeypotManager, type Honeypot } from '../security/honeypot-manager.js';

export interface DeceptionTrap {
  id: string;
  name: string;
  label: string;
  type: string;
  status: string;
  triggered: boolean;
  hit_count: number;
  last_triggered: string | null;
  last_seen: string | null;
  instance_id: string | null;
}

function honeypotToTrap(honeypot: Honeypot): DeceptionTrap {
  const type = honeypot.type === 'token' ? 'canary_token' : honeypot.type;
  const status = honeypot.retiredAt ? 'retired' : honeypot.triggered ? 'triggered' : 'active';

  return {
    id: honeypot.id,
    name: honeypot.name,
    label: honeypot.value.slice(0, 32),
    type,
    status,
    triggered: honeypot.triggered,
    hit_count: honeypot.triggered ? 1 : 0,
    last_triggered: honeypot.triggeredAt?.toISOString() ?? null,
    last_seen: honeypot.triggeredAt?.toISOString() ?? honeypot.createdAt.toISOString(),
    instance_id: honeypot.instanceId,
  };
}

function markerToTrap(marker: { value: string; rotatedAt: Date }, kind: 'current' | 'retired'): DeceptionTrap {
  return {
    id: `marker-${kind}-${marker.value.slice(0, 8)}`,
    name: kind === 'current' ? 'Moving target marker' : 'Retired marker',
    label: marker.value.slice(0, 32),
    type: 'moving_target_marker',
    status: kind === 'current' ? 'active' : 'retired',
    triggered: false,
    hit_count: 0,
    last_triggered: null,
    last_seen: marker.rotatedAt.toISOString(),
    instance_id: null,
  };
}

export async function listDeceptionTraps(options: {
  instanceId?: string;
  limit?: number;
} = {}): Promise<DeceptionTrap[]> {
  const limit = Math.min(Math.max(options.limit ?? 200, 1), 200);
  const honeypots = await honeypotManager.listRecentHoneypots(options.instanceId, limit);
  const traps = honeypots.map(honeypotToTrap);

  traps.unshift(markerToTrap(movingTarget.getCurrentMarker(), 'current'));
  for (const previous of movingTarget.getPreviousMarkers()) {
    traps.push(markerToTrap(previous, 'retired'));
  }

  return traps.slice(0, limit);
}
