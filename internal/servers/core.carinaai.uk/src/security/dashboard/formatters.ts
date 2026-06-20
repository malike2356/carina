import type { SecurityDashboardData } from './types.js';

function bar(score: number, width = 14): string {
  const filled = Math.round((score / 100) * width);
  return `${'█'.repeat(filled)}${'░'.repeat(Math.max(0, width - filled))}`;
}

function threatLabel(level: SecurityDashboardData['threatLevel']): string {
  return level.toUpperCase();
}

export function formatDashboardSummary(data: SecurityDashboardData): string {
  const lines = [
    'Security operations dashboard',
    `Generated: ${data.generatedAt}`,
    `Threat level: ${threatLabel(data.threatLevel)}`,
    `Active threats: ${data.activeThreats}`,
    `Trust score: ${data.trustScore}/100 (${data.trustScoreTrend >= 0 ? '+' : ''}${data.trustScoreTrend})`,
    `Incidents this week: ${data.incidentsThisWeek} (${data.incidentsTrend >= 0 ? '+' : ''}${data.incidentsTrend}%)`,
    `RASP: ${data.raspStatus}`,
    `Scout: ${data.scoutStatus.armed ? 'armed' : 'off'}${data.scoutStatus.connected ? ' (connected)' : ''}`,
    `Kill switch: ${data.killSwitchActive ? 'ACTIVE' : 'inactive'}`,
    '',
    'Compliance:',
  ];

  for (const framework of data.complianceStatus.frameworks) {
    lines.push(
      `  ${framework.name}: ${framework.scorePercent}% ${bar(framework.scorePercent)}`,
    );
  }

  lines.push(
    '',
    `Red team: ${data.redTeamResults.passedCount}/${data.redTeamResults.totalCount} passed (${data.redTeamResults.passRatePercent}%)`,
    `Supply chain vulnerabilities: ${data.supplyChainHealth.vulnerabilityCount}`,
    `Secrets active: ${data.secretsStatus.activeCount} (expiring soon: ${data.secretsStatus.expiringSoonCount})`,
  );

  return lines.join('\n');
}

export function formatDashboardTui(data: SecurityDashboardData, width = 72): string {
  const lines = [
    'SECURITY DASHBOARD',
    '',
    `Threat Level: ${threatLabel(data.threatLevel).padEnd(8)} Trust: ${data.trustScore}/100     RASP: ${data.raspStatus.toUpperCase()}`,
    `Active Threats: ${String(data.activeThreats).padEnd(3)} Incidents: ${data.incidentsThisWeek}/wk    Scout: ${data.scoutStatus.armed ? 'ARMED' : 'OFF'}`,
    '',
    'Real-time Events',
  ];

  if (data.realTimeEvents.length === 0) {
    lines.push('  (no recent events)');
  } else {
    for (const event of data.realTimeEvents.slice(0, 6)) {
      const time = event.timestamp.slice(11, 19);
      const action = event.action.toUpperCase().padEnd(7);
      const label = event.label.slice(0, 18).padEnd(18);
      lines.push(`  ${time}  ${action}  ${label}  ${event.agentId.slice(0, width - 40)}`);
    }
  }

  lines.push('', 'Compliance');
  for (const framework of data.complianceStatus.frameworks) {
    const prefix = `${framework.id.toUpperCase()}: ${framework.scorePercent}%`.padEnd(16);
    lines.push(`  ${prefix}${bar(framework.scorePercent)}`);
  }

  lines.push(
    '',
    'Press /security for summary    F6 security panel',
    ':pentest :redteam :forensics :compliance :secrets',
  );

  return lines.join('\n').slice(0, width * 20);
}
