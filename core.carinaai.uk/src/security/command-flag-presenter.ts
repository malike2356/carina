import chalk from 'chalk';
import type { CommandFlag, FlagLevel } from './command-flag.js';

function levelLabel(level: FlagLevel): string {
  return level.toUpperCase();
}

function colorizeLevel(level: FlagLevel, text: string): string {
  switch (level) {
    case 'critical':
      return chalk.red.bold(text);
    case 'danger':
      return chalk.yellow.bold(text);
    case 'warn':
      return chalk.yellow(text);
    default:
      return text;
  }
}

function footerLine(flag: CommandFlag): string {
  switch (flag.level) {
    case 'critical':
      return '  BLOCKED. Set CARINA_COMMAND_FLAG_OVERRIDE=1 to force. This is not recommended.';
    case 'danger':
      return '';
    case 'warn':
      return '  Flagging logged. Proceeding.';
    default:
      return '';
  }
}

export function formatCommandFlag(flag: CommandFlag): string {
  const lines = [
    chalk.dim('  CARINA SAFETY FLAG'),
    chalk.dim('  ------------------'),
    `  Command : ${flag.command}`,
    `  Risk    : ${colorizeLevel(flag.level, levelLabel(flag.level))}`,
    `  Action  : ${flag.whatItDoes}`,
  ];

  if (flag.riskDetail) {
    lines.push(`  Detail  : ${flag.riskDetail}`);
  }

  lines.push('');
  lines.push(footerLine(flag));
  return lines.join('\n');
}

export type FlagAuditDecision = 'approved' | 'declined' | 'auto' | 'auto-declined';

export function formatFlaggedAuditEntry(
  flag: CommandFlag,
  decision: FlagAuditDecision,
  sessionId = 'unknown',
): string {
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  return `[${timestamp}] FLAGGED command=${flag.command} level=${flag.level.toUpperCase()} decision=${decision} session=${sessionId}`;
}
