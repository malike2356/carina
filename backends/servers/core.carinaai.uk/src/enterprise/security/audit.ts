import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { GENESIS_HASH, sha256 } from '../../security/forensics/hash.js';
import { immutableAuditPath, merkleRootsPath } from './paths.js';
import type { ImmutableAuditEvent, MerkleRootRecord } from './types.js';

function canonicalEventPayload(event: Omit<ImmutableAuditEvent, 'eventHash' | 'merkleRoot'>): string {
  return JSON.stringify({
    id: event.id,
    sequence: event.sequence,
    timestamp: event.timestamp,
    tenantId: event.tenantId,
    actorId: event.actorId,
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    details: event.details,
    previousHash: event.previousHash,
  });
}

function computeEventHash(event: Omit<ImmutableAuditEvent, 'eventHash' | 'merkleRoot'>): string {
  return sha256(canonicalEventPayload(event));
}

async function readEvents(): Promise<ImmutableAuditEvent[]> {
  try {
    const raw = await fs.readFile(immutableAuditPath(), 'utf8');
    const rows: ImmutableAuditEvent[] = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        rows.push(JSON.parse(line) as ImmutableAuditEvent);
      } catch {
        // skip corrupt line
      }
    }
    return rows;
  } catch {
    return [];
  }
}

async function readMerkleRoots(): Promise<MerkleRootRecord[]> {
  try {
    const raw = await fs.readFile(merkleRootsPath(), 'utf8');
    const parsed = JSON.parse(raw) as MerkleRootRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeMerkleRoots(rows: MerkleRootRecord[]): Promise<void> {
  const dir = merkleRootsPath().replace(/\/[^/]+$/, '');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(merkleRootsPath(), JSON.stringify(rows, null, 2), { mode: 0o600 });
}

function buildMerkleRoot(hashes: string[]): string {
  if (hashes.length === 0) return GENESIS_HASH;
  let layer = [...hashes];
  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i]!;
      const right = layer[i + 1] ?? left;
      next.push(sha256(left + right));
    }
    layer = next;
  }
  return layer[0]!;
}

function hourBucket(timestamp: number): string {
  const date = new Date(timestamp);
  date.setMinutes(0, 0, 0);
  return date.toISOString();
}

export class ImmutableEnterpriseAudit {
  async append(input: {
    tenantId: string;
    actorId: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    details?: Record<string, unknown>;
  }): Promise<ImmutableAuditEvent> {
    const events = await readEvents();
    const previousHash = events.length > 0 ? events[events.length - 1]!.eventHash : GENESIS_HASH;
    const draft: Omit<ImmutableAuditEvent, 'eventHash' | 'merkleRoot'> = {
      id: randomUUID(),
      sequence: events.length + 1,
      timestamp: Date.now(),
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      details: input.details ?? {},
      previousHash,
    };
    const eventHash = computeEventHash(draft);
    const hour = hourBucket(draft.timestamp);
    const hourEvents = [...events.filter((row) => hourBucket(row.timestamp) === hour), {
      ...draft,
      eventHash,
    }];
    const merkleRoot = buildMerkleRoot(hourEvents.map((row) => row.eventHash));
    const record: ImmutableAuditEvent = { ...draft, eventHash, merkleRoot };
    const dir = immutableAuditPath().replace(/\/[^/]+$/, '');
    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(immutableAuditPath(), `${JSON.stringify(record)}\n`, { mode: 0o600 });
    await this.publishMerkleRoot(hour, hourEvents.length, events.length + 1);
    return record;
  }

  private async publishMerkleRoot(hour: string, eventCount: number, lastSequence: number): Promise<void> {
    const events = await readEvents();
    const hourHashes = events
      .filter((row) => hourBucket(row.timestamp) === hour)
      .map((row) => row.eventHash);
    const roots = await readMerkleRoots();
    const firstSequence = lastSequence - eventCount + 1;
    const record: MerkleRootRecord = {
      hour,
      rootHash: buildMerkleRoot(hourHashes),
      eventCount,
      firstSequence,
      lastSequence,
      publishedAt: Date.now(),
    };
    const next = roots.filter((row) => row.hour !== hour);
    next.push(record);
    await writeMerkleRoots(next.sort((a, b) => a.hour.localeCompare(b.hour)));
  }

  async verifyChain(): Promise<{ valid: boolean; events: number; brokenAt?: string }> {
    const events = await readEvents();
    let previousHash = GENESIS_HASH;
    for (const event of events) {
      if (event.previousHash !== previousHash) {
        return { valid: false, events: events.length, brokenAt: event.id };
      }
      const expected = computeEventHash({
        id: event.id,
        sequence: event.sequence,
        timestamp: event.timestamp,
        tenantId: event.tenantId,
        actorId: event.actorId,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        details: event.details,
        previousHash: event.previousHash,
      });
      if (expected !== event.eventHash) {
        return { valid: false, events: events.length, brokenAt: event.id };
      }
      previousHash = event.eventHash;
    }
    return { valid: true, events: events.length };
  }

  async verifyEvent(eventId: string): Promise<{
    verified: boolean;
    event?: ImmutableAuditEvent;
    merkleProof?: { siblings: string[]; rootHash: string };
  }> {
    const events = await readEvents();
    const event = events.find((row) => row.id === eventId);
    if (!event) return { verified: false };

    const chain = await this.verifyChain();
    if (!chain.valid) return { verified: false, event };

    const hourEvents = events.filter((row) => hourBucket(row.timestamp) === hourBucket(event.timestamp));
    const index = hourEvents.findIndex((row) => row.id === eventId);
    if (index < 0) return { verified: false, event };

    const siblings: string[] = [];
    let layer = hourEvents.map((row) => row.eventHash);
    let cursor = index;
    while (layer.length > 1) {
      const pairIndex = cursor % 2 === 0 ? cursor + 1 : cursor - 1;
      if (pairIndex >= 0 && pairIndex < layer.length) siblings.push(layer[pairIndex]!);
      const next: string[] = [];
      for (let i = 0; i < layer.length; i += 2) {
        next.push(sha256(layer[i]! + (layer[i + 1] ?? layer[i]!)));
      }
      layer = next;
      cursor = Math.floor(cursor / 2);
    }

    return {
      verified: true,
      event,
      merkleProof: {
        siblings,
        rootHash: layer[0] ?? GENESIS_HASH,
      },
    };
  }

  async exportJsonl(limit = 500): Promise<string> {
    const events = await readEvents();
    return events.slice(-limit).map((row) => JSON.stringify(row)).join('\n');
  }

  async listMerkleRoots(): Promise<MerkleRootRecord[]> {
    return readMerkleRoots();
  }
}

export const immutableEnterpriseAudit = new ImmutableEnterpriseAudit();

export async function resetImmutableEnterpriseAuditForTests(): Promise<void> {
  try {
    const root = immutableAuditPath().replace(/\/[^/]+$/, '');
    await fs.rm(root, { recursive: true, force: true });
  } catch {
    // ignore
  }
}
