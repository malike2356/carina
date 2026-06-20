import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { GENESIS_HASH, sha256 } from '../forensics/hash.js';
import type {
  AuditOutcome,
  AuditSearchOptions,
  GovernanceAction,
  GovernanceAuditEvent,
  GovernanceRole,
} from './types.js';
import { auditTrailPath, governanceRoot } from './paths.js';

type AppendAuditInput = {
  actor: GovernanceAuditEvent['actor'];
  action: GovernanceAuditEvent['action'];
  outcome: AuditOutcome;
  reason?: string;
};

function computeAuditHash(record: Omit<GovernanceAuditEvent, 'hash'>): string {
  return sha256(JSON.stringify({
    id: record.id,
    timestamp: record.timestamp,
    actor: record.actor,
    action: record.action,
    outcome: record.outcome,
    reason: record.reason,
    previousHash: record.previousHash,
  }));
}

async function readAuditRecords(): Promise<GovernanceAuditEvent[]> {
  try {
    const raw = await fs.readFile(auditTrailPath(), 'utf8');
    const rows: GovernanceAuditEvent[] = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        rows.push(JSON.parse(line) as GovernanceAuditEvent);
      } catch {
        // skip corrupt line
      }
    }
    return rows;
  } catch {
    return [];
  }
}

export class GovernanceAuditTrail {
  async append(input: AppendAuditInput): Promise<GovernanceAuditEvent> {
    const records = await readAuditRecords();
    const previousHash = records.length > 0 ? records[records.length - 1]!.hash : GENESIS_HASH;
    const draft: Omit<GovernanceAuditEvent, 'hash'> = {
      id: randomUUID(),
      timestamp: Date.now(),
      actor: input.actor,
      action: input.action,
      outcome: input.outcome,
      reason: input.reason,
      previousHash,
    };
    const record: GovernanceAuditEvent = {
      ...draft,
      hash: computeAuditHash(draft),
    };
    await fs.mkdir(governanceRoot(), { recursive: true });
    await fs.appendFile(auditTrailPath(), `${JSON.stringify(record)}\n`, { mode: 0o600 });
    return record;
  }

  async verify(): Promise<{ valid: boolean; events: number; brokenAt?: string }> {
    const records = await readAuditRecords();
    let previousHash = GENESIS_HASH;
    for (const record of records) {
      if (record.previousHash !== previousHash) {
        return { valid: false, events: records.length, brokenAt: record.id };
      }
      const expected = computeAuditHash({
        id: record.id,
        timestamp: record.timestamp,
        actor: record.actor,
        action: record.action,
        outcome: record.outcome,
        reason: record.reason,
        previousHash: record.previousHash,
      });
      if (expected !== record.hash) {
        return { valid: false, events: records.length, brokenAt: record.id };
      }
      previousHash = record.hash;
    }
    return { valid: true, events: records.length };
  }

  async search(options: AuditSearchOptions = {}): Promise<GovernanceAuditEvent[]> {
    const limit = Math.min(500, Math.max(1, options.limit ?? 50));
    let rows = await readAuditRecords();
    if (options.userId) rows = rows.filter((row) => row.actor.userId === options.userId);
    if (options.resource) rows = rows.filter((row) => row.action.resource === options.resource);
    if (options.outcome) rows = rows.filter((row) => row.outcome === options.outcome);
    return rows.slice(-limit);
  }

  async exportJson(limit = 500): Promise<GovernanceAuditEvent[]> {
    return this.search({ limit });
  }

  async exportCsv(limit = 500): Promise<string> {
    const rows = await this.search({ limit });
    const lines = ['id,timestamp,userId,role,resource,action,outcome,hash'];
    for (const row of rows) {
      lines.push([
        row.id,
        new Date(row.timestamp).toISOString(),
        row.actor.userId,
        row.actor.role,
        row.action.resource,
        row.action.type,
        row.outcome,
        row.hash,
      ].join(','));
    }
    return lines.join('\n');
  }
}

export const governanceAuditTrail = new GovernanceAuditTrail();

export async function recordGovernanceAudit(input: {
  userId: string;
  role: GovernanceRole;
  ip?: string;
  sessionId?: string;
  resource: string;
  resourceId?: string;
  action: GovernanceAction;
  outcome?: AuditOutcome;
  reason?: string;
  details?: Record<string, unknown>;
}): Promise<GovernanceAuditEvent> {
  return governanceAuditTrail.append({
    actor: {
      userId: input.userId,
      role: input.role,
      ip: input.ip ?? '127.0.0.1',
      sessionId: input.sessionId ?? 'system',
    },
    action: {
      type: input.action,
      resource: input.resource,
      resourceId: input.resourceId ?? '',
      details: input.details ?? {},
    },
    outcome: input.outcome ?? 'success',
    reason: input.reason,
  });
}

export async function _resetGovernanceAuditForTests(): Promise<void> {
  try {
    await fs.rm(governanceRoot(), { recursive: true, force: true });
  } catch {
    // ignore
  }
}
