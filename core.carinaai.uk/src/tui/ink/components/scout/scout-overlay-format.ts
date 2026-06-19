import type { ScoutPanelSnapshot } from '../../../panels/scout-panel.js';

export function countActiveThreats(events: ScoutPanelSnapshot['recentEvents']): number {
  return events.filter((e) => e.severity === 'critical' || e.severity === 'warning').length;
}

export function trustBar(score: number, width = 10): string {
  const clamped = Math.max(0, Math.min(100, score));
  const filled = Math.round((clamped / 100) * width);
  return `${'●'.repeat(filled)}${'○'.repeat(Math.max(0, width - filled))}`;
}

export function shieldLabel(scoutLinked: boolean): { text: string; tone: 'active' | 'offline' } {
  return scoutLinked
    ? { text: 'ACTIVE', tone: 'active' }
    : { text: 'OFFLINE', tone: 'offline' };
}

export function killSwitchLabel(active: boolean): { text: string; tone: 'armed' | 'off' } {
  return active
    ? { text: 'TRIGGERED', tone: 'armed' }
    : { text: 'off', tone: 'off' };
}

export function formatCompactScoutLine(
  snapshot: ScoutPanelSnapshot,
  scoutLinked: boolean,
): string {
  const threats = countActiveThreats(snapshot.recentEvents);
  const shield = shieldLabel(scoutLinked);
  const kill = killSwitchLabel(snapshot.killSwitchActive);
  return [
    `Scout: Trust ${snapshot.trustScore}/100`,
    `${threats} threat${threats === 1 ? '' : 's'}`,
    `Shield: ${shield.text}`,
    `Kill Switch: ${kill.text}`,
  ].join(' | ');
}

export function formatEventTime(iso: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return iso.slice(0, 8);
  return new Date(parsed).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
