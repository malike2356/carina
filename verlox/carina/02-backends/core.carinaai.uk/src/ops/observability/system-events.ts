import { listPairedDevices } from '../../infrastructure/device-pairing.js';
import { listPairedNodes } from '../../infrastructure/node-host/store.js';
import { listAcpSessions } from '../../infrastructure/acp-bridge/store.js';

export type PresenceKind = 'device' | 'node' | 'agent' | 'operator';

export type PresenceEntry = {
  id: string;
  kind: PresenceKind;
  label: string;
  lastSeenAt: string;
  online: boolean;
  meta?: Record<string, unknown>;
};

export type SystemEvent = {
  id: string;
  ts: string;
  type: string;
  message: string;
  presence?: PresenceKind;
  entityId?: string;
  meta?: Record<string, unknown>;
};

const PRESENCE_ONLINE_MS = 5 * 60 * 1000;
const MAX_EVENTS = 500;

const eventRing: SystemEvent[] = [];

function isOnline(lastSeenAt: string): boolean {
  return Date.now() - new Date(lastSeenAt).getTime() < PRESENCE_ONLINE_MS;
}

export function emitSystemEvent(input: Omit<SystemEvent, 'id' | 'ts'>): SystemEvent {
  const event: SystemEvent = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    ...input,
  };
  eventRing.push(event);
  if (eventRing.length > MAX_EVENTS) {
    eventRing.splice(0, eventRing.length - MAX_EVENTS);
  }
  return event;
}

export function listSystemEvents(limit = 50): SystemEvent[] {
  return [...eventRing].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, limit);
}

export function collectPresence(): PresenceEntry[] {
  const entries: PresenceEntry[] = [];

  for (const device of listPairedDevices()) {
    entries.push({
      id: device.id,
      kind: 'device',
      label: device.name,
      lastSeenAt: device.lastSeenAt,
      online: isOnline(device.lastSeenAt),
      meta: { platform: device.platform, scopes: device.scopes },
    });
  }

  if (process.env.CARINA_NODE_HOST_ENABLED === 'true') {
    for (const node of listPairedNodes()) {
      entries.push({
        id: node.id,
        kind: 'node',
        label: node.name,
        lastSeenAt: node.lastSeenAt,
        online: isOnline(node.lastSeenAt),
        meta: { hostname: node.hostname, platform: node.platform },
      });
    }
  }

  for (const session of listAcpSessions()) {
    entries.push({
      id: session.sessionId,
      kind: 'agent',
      label: session.label ?? session.sessionId,
      lastSeenAt: session.lastUsed,
      online: isOnline(session.lastUsed),
      meta: { provenance: session.provenance, createdAt: session.createdAt },
    });
  }

  const phoneNodeId = process.env.CARINA_PHONE_NODE_ID;
  if (phoneNodeId) {
    const phoneNode = listPairedNodes().find((n) => n.id === phoneNodeId);
    if (phoneNode) {
      entries.push({
        id: phoneNode.id,
        kind: 'device',
        label: `phone:${phoneNode.name}`,
        lastSeenAt: phoneNode.lastSeenAt,
        online: isOnline(phoneNode.lastSeenAt),
        meta: { role: 'phone', hostname: phoneNode.hostname },
      });
    }
  }

  return entries.sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
}

export function recordPresenceHeartbeat(kind: PresenceKind, entityId: string, label?: string): void {
  emitSystemEvent({
    type: 'presence.heartbeat',
    message: `${kind} heartbeat`,
    presence: kind,
    entityId,
    meta: { label },
  });
}
