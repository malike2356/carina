import type pg from 'pg';
import { pool } from '../db.js';

export interface ShieldDetection {
  layer: 1 | 2 | 3;
  patterns: string[];
  confidence: number;
}

export interface ShieldReport {
  message: string;
  ref: string;
  detection: ShieldDetection;
}

const counters = new Map<string, number>();

export async function buildShieldReport(
  detection: ShieldDetection,
  db: Pick<pg.Pool, 'query'> = pool,
  now = new Date(),
): Promise<ShieldReport> {
  const day = now.toISOString().slice(0, 10);
  const sequence = await nextSequence(day, db);
  const ref = `SHIELD-${day}-${String(sequence).padStart(3, '0')}`;
  return {
    ref,
    detection,
    message: `I'm unable to process that request. Security shield detected a potential prompt injection attempt. This incident has been logged. (Ref: ${ref})`,
  };
}

async function nextSequence(day: string, db: Pick<pg.Pool, 'query'>): Promise<number> {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS shield_ref_counters (
        day TEXT PRIMARY KEY,
        sequence INTEGER NOT NULL DEFAULT 0
      )
    `);
    const result = await db.query<{ sequence: number }>(
      `INSERT INTO shield_ref_counters (day, sequence)
       VALUES ($1, 1)
       ON CONFLICT (day)
       DO UPDATE SET sequence = shield_ref_counters.sequence + 1
       RETURNING sequence`,
      [day],
    );
    return result.rows[0]?.sequence ?? nextMemorySequence(day);
  } catch {
    return nextMemorySequence(day);
  }
}

function nextMemorySequence(day: string): number {
  const next = (counters.get(day) ?? 0) + 1;
  counters.set(day, next);
  return next;
}

export function _resetShieldReportCounters(): void {
  counters.clear();
}
