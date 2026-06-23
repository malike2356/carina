import fs from 'node:fs';
import path from 'node:path';
import { CARINA_HOME } from '../config/paths.js';
import type { CommandFlag } from './command-flag.js';
import { formatFlaggedAuditEntry, type FlagAuditDecision } from './command-flag-presenter.js';

const AUDIT_PATH = () => path.join(CARINA_HOME, 'audit.log');

export function appendFlagAudit(
  flag: CommandFlag,
  decision: FlagAuditDecision,
  sessionId: string,
): void {
  const line = `${formatFlaggedAuditEntry(flag, decision, sessionId)}\n`;
  try {
    fs.mkdirSync(CARINA_HOME, { recursive: true });
    fs.appendFileSync(AUDIT_PATH(), line, 'utf8');
  } catch {
    // audit must not block execution
  }
}

export function _resetFlagAuditForTests(): void {
  try {
    fs.unlinkSync(AUDIT_PATH());
  } catch {
    // ignore
  }
}
