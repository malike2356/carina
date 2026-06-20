import fs from 'fs';
import path from 'path';
import { CARINA_HOME } from '../../config/paths.js';

const AUDIT_FILE = path.join(CARINA_HOME, 'node-audit.jsonl');

export type NodeAuditEvent = {
  at: string;
  action: string;
  nodeId?: string;
  detail?: string;
  actor?: string;
};

export function appendNodeAudit(event: Omit<NodeAuditEvent, 'at'>): void {
  const row: NodeAuditEvent = { ...event, at: new Date().toISOString() };
  fs.mkdirSync(CARINA_HOME, { recursive: true });
  fs.appendFileSync(AUDIT_FILE, `${JSON.stringify(row)}\n`, { mode: 0o600 });
}

export function readRecentNodeAudit(limit = 50): NodeAuditEvent[] {
  if (!fs.existsSync(AUDIT_FILE)) return [];
  const lines = fs.readFileSync(AUDIT_FILE, 'utf-8').trim().split('\n').filter(Boolean);
  return lines.slice(-limit).map((line) => JSON.parse(line) as NodeAuditEvent);
}
