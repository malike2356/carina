import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { GENESIS_HASH, sha256 } from './hash.js';
import { custodyLogPath } from './paths.js';
import type { CustodyAction, CustodyRecord } from './types.js';

type RecordInput = {
  evidenceId: string;
  action: CustodyAction;
  actor: string;
  actorRole: string;
  timestamp: number;
  reason: string;
};

function computeRecordHash(record: Omit<CustodyRecord, 'hash'>): string {
  return sha256(JSON.stringify({
    id: record.id,
    evidenceId: record.evidenceId,
    action: record.action,
    actor: record.actor,
    actorRole: record.actorRole,
    timestamp: record.timestamp,
    reason: record.reason,
    previousHash: record.previousHash,
  }));
}

async function readCustodyRecords(): Promise<CustodyRecord[]> {
  try {
    const raw = await fs.readFile(custodyLogPath(), 'utf8');
    const rows: CustodyRecord[] = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        rows.push(JSON.parse(line) as CustodyRecord);
      } catch {
        // skip corrupt line
      }
    }
    return rows;
  } catch {
    return [];
  }
}

async function appendToImmutableLog(record: CustodyRecord): Promise<void> {
  const file = custodyLogPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, `${JSON.stringify(record)}\n`, 'utf8');
}

export class ChainOfCustody {
  private records: CustodyRecord[] = [];
  private loaded = false;

  async load(): Promise<void> {
    if (this.loaded) return;
    this.records = await readCustodyRecords();
    this.loaded = true;
  }

  async record(action: RecordInput): Promise<CustodyRecord> {
    await this.load();
    const previousHash = this.records.length > 0
      ? this.records[this.records.length - 1]!.hash
      : GENESIS_HASH;

    const draft: Omit<CustodyRecord, 'hash'> = {
      ...action,
      id: randomUUID(),
      previousHash,
    };
    const record: CustodyRecord = {
      ...draft,
      hash: computeRecordHash(draft),
    };

    this.records.push(record);
    await appendToImmutableLog(record);
    return record;
  }

  async list(evidenceId?: string): Promise<CustodyRecord[]> {
    await this.load();
    if (!evidenceId) return [...this.records];
    return this.records.filter((row) => row.evidenceId === evidenceId);
  }

  async verify(): Promise<{ valid: boolean; brokenAt: number | null }> {
    await this.load();
    for (let i = 0; i < this.records.length; i++) {
      const record = this.records[i]!;
      const expectedPrevious = i > 0 ? this.records[i - 1]!.hash : GENESIS_HASH;
      if (record.previousHash !== expectedPrevious) {
        return { valid: false, brokenAt: i };
      }
      const recomputed = computeRecordHash(record);
      if (recomputed !== record.hash) {
        return { valid: false, brokenAt: i };
      }
    }
    return { valid: true, brokenAt: null };
  }
}

export const chainOfCustody = new ChainOfCustody();

export async function _resetCustodyLogForTests(): Promise<void> {
  try {
    await fs.unlink(custodyLogPath());
  } catch {
    // ignore
  }
}
