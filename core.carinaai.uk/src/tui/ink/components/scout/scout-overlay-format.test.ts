import { describe, expect, it } from 'vitest';
import {
  countActiveThreats,
  formatCompactScoutLine,
  killSwitchLabel,
  shieldLabel,
  trustBar,
} from './scout-overlay-format.js';
import type { ScoutPanelSnapshot } from '../../../panels/scout-panel.js';

const baseSnapshot: ScoutPanelSnapshot = {
  trustScore: 87,
  killSwitchActive: false,
  killSwitchReason: '',
  recentEvents: [
    { severity: 'warning', timestamp: '2026-06-19T10:00:00.000Z', summary: 'tool: deny' },
    { severity: 'info', timestamp: '2026-06-19T09:00:00.000Z', summary: 'audit: ok' },
  ],
};

describe('scout overlay format', () => {
  it('counts warning and critical events as active threats', () => {
    expect(countActiveThreats(baseSnapshot.recentEvents)).toBe(1);
  });

  it('renders trust bar with filled and empty segments', () => {
    expect(trustBar(50, 10)).toBe('●●●●●○○○○○');
  });

  it('builds compact scout status line', () => {
    const line = formatCompactScoutLine(baseSnapshot, true);
    expect(line).toContain('Trust 87/100');
    expect(line).toContain('1 threat');
    expect(line).toContain('Shield: ACTIVE');
    expect(line).toContain('Kill Switch: off');
  });

  it('labels shield and kill switch states', () => {
    expect(shieldLabel(true).text).toBe('ACTIVE');
    expect(shieldLabel(false).text).toBe('OFFLINE');
    expect(killSwitchLabel(true).text).toBe('TRIGGERED');
    expect(killSwitchLabel(false).text).toBe('off');
  });
});
