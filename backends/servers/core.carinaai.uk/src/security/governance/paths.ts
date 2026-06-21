import path from 'node:path';
import { resolveCarinaDataDir } from '../../config/paths.js';

export function governanceRoot(): string {
  return path.join(resolveCarinaDataDir(), 'governance');
}

export function auditTrailPath(): string {
  return path.join(governanceRoot(), 'audit-trail.jsonl');
}

export function policiesPath(): string {
  return path.join(governanceRoot(), 'policies.json');
}

export function trustHistoryPath(): string {
  return path.join(governanceRoot(), 'trust-history.json');
}

export const DEFAULT_AUDIT_RETENTION_YEARS = 7;
