import type { ScoutSecurityEvent, SecuritySeverity } from '@/api/types';

const ALERT_SEVERITIES = new Set<SecuritySeverity>(['warning', 'critical', 'breach']);

export function shouldAlertForSeverity(severity: SecuritySeverity): boolean {
  return ALERT_SEVERITIES.has(severity);
}

export function buildScoutAlertContent(event: ScoutSecurityEvent): { title: string; body: string } {
  const title =
    event.severity === 'critical' || event.severity === 'breach'
      ? 'Scout security alert'
      : 'Scout security notice';
  const body = truncate(event.description || event.event_type, 120);
  return { title, body };
}

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}
