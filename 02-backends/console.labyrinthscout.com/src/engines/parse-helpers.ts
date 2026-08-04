import type { FindingSeverity } from '../findings/types.js';
import type { EngineFinding } from './types.js';

export function mapSeverity(raw?: string): FindingSeverity {
  const s = (raw ?? 'info').toLowerCase();
  if (s === 'critical') return 'critical';
  if (s === 'high') return 'high';
  if (s === 'medium') return 'medium';
  if (s === 'low') return 'low';
  return 'info';
}

export function parseJsonLines<T>(output: string): T[] {
  const rows: T[] = [];
  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) continue;
    try {
      const parsed = JSON.parse(trimmed) as T | T[];
      if (Array.isArray(parsed)) rows.push(...parsed);
      else rows.push(parsed);
    } catch {
      // skip malformed lines
    }
  }
  return rows;
}

export function misconfigFinding(
  tool: string,
  title: string,
  description: string,
  severity: FindingSeverity = 'medium',
  rawData?: Record<string, unknown>,
): EngineFinding {
  return {
    tool,
    findingType: 'misconfig',
    severity,
    title,
    description,
    rawData,
  };
}

export function skippedResult(tool: string): { findings: EngineFinding[]; engine: string } {
  return { findings: [], engine: `${tool}:skipped` };
}
