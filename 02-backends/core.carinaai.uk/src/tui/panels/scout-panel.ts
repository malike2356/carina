import { config } from '../../config/index.js';
import { scoutIntegrationRequested } from '../../security/load-scout-package.js';
import { isSuspended, isAllowlistEnforced } from '../../security/kill-switch-listener.js';
import { readSecurityAuditTail, type SecurityAuditEvent } from '../../security/security-audit.js';

export interface ScoutPanelSnapshot {
  trustScore: number;
  killSwitchActive: boolean;
  killSwitchReason: string;
  recentEvents: Array<{
    severity: 'info' | 'warning' | 'critical';
    timestamp: string;
    summary: string;
  }>;
}

export function buildScoutSnapshot(): ScoutPanelSnapshot {
  const events = readSecurityAuditTail(20).reverse();
  let trustScore = 100;
  const killSwitchActive = isSuspended();
  let killSwitchReason = '';

  if (killSwitchActive) {
    trustScore -= 50;
    killSwitchReason = 'Labyrinth Scout suspension active';
  }
  if (scoutIntegrationRequested() && !config.labyrinth.enabled) {
    trustScore -= 15;
  }
  if (isAllowlistEnforced()) {
    trustScore -= 5;
  }

  const recentEvents = events.slice(0, 8).map(mapAuditEvent);
  for (const event of recentEvents) {
    if (event.severity === 'critical') trustScore -= 8;
    else if (event.severity === 'warning') trustScore -= 3;
  }

  return {
    trustScore: Math.max(0, Math.min(100, trustScore)),
    killSwitchActive,
    killSwitchReason,
    recentEvents,
  };
}

function mapAuditEvent(event: SecurityAuditEvent): ScoutPanelSnapshot['recentEvents'][number] {
  let severity: 'info' | 'warning' | 'critical' = 'info';
  if (event.category === 'kill_switch' || event.category === 'prompt_injection') {
    severity = 'critical';
  } else if (event.action === 'block' || event.action === 'deny') {
    severity = 'warning';
  }
  const summary = [event.category, event.action, event.detail].filter(Boolean).join(': ');
  return { severity, timestamp: event.at, summary };
}

export class ScoutPanel {
  async getLines(width: number, height: number): Promise<string[]> {
    const report = buildScoutSnapshot();
    const lines: string[] = [];

    const score = report.trustScore;
    const scoreColor = score >= 90 ? '\x1b[32m' : score >= 70 ? '\x1b[33m' : '\x1b[31m';
    lines.push(`${scoreColor}Trust: ${score}/100\x1b[0m`);
    lines.push('');

    if (report.killSwitchActive) {
      lines.push('\x1b[41m\x1b[37m KILL SWITCH ACTIVE \x1b[0m');
      if (report.killSwitchReason) {
        lines.push(`\x1b[31m${report.killSwitchReason.slice(0, width)}\x1b[0m`);
      }
      lines.push('');
    }

    const scoutOn = config.labyrinth.enabled ? 'Scout: linked' : 'Scout: off';
    lines.push(`\x1b[90m${scoutOn}\x1b[0m`);
    lines.push('');

    lines.push('\x1b[90mRecent Events:\x1b[0m');
    if (report.recentEvents.length === 0) {
      lines.push('\x1b[90m(none logged)\x1b[0m');
    }
    for (const event of report.recentEvents) {
      const severity = event.severity === 'critical' ? '\x1b[31m'
        : event.severity === 'warning' ? '\x1b[33m' : '\x1b[90m';
      const time = new Date(event.timestamp).toLocaleTimeString();
      const msg = event.summary.slice(0, Math.max(8, width - 12));
      lines.push(`${severity}[${event.severity.slice(0, 4).toUpperCase()}]\x1b[0m ${time} ${msg}`);
    }

    return lines.slice(0, height);
  }
}

export async function getShieldReport(): Promise<ScoutPanelSnapshot> {
  return buildScoutSnapshot();
}
