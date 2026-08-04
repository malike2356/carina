import { describe, expect, it, vi } from 'vitest';
import {
  buildCheckInPrompt,
  parseCheckInResponse,
  shouldStayQuiet,
  type CheckInState,
} from './check-in.js';

vi.mock('./checks/email-check.js', () => ({
  checkRecentInboundEmails: vi.fn(async () => ({ name: 'email', urgent: false, summary: null })),
}));

vi.mock('./checks/weather-check.js', () => ({
  checkWeather: vi.fn(async () => ({ name: 'weather', urgent: false, summary: 'Mild weather.' })),
}));

vi.mock('./checks/project-status-check.js', () => ({
  checkProjectStatus: vi.fn(async () => ({ name: 'project-status', urgent: false, summary: 'Clean.' })),
}));

describe('shouldStayQuiet', () => {
  it('stays quiet during quiet hours unless urgent', () => {
    const base = {
      now: new Date('2026-01-01T23:30:00Z'),
      quietHours: { startHour: 23, endHour: 8, timezone: 'UTC' },
      urgentSignals: [],
    };

    expect(shouldStayQuiet(base)).toBe(true);
    expect(shouldStayQuiet({ ...base, urgentSignals: [{ name: 'weather', urgent: true, summary: 'Storm' }] })).toBe(false);
  });

  it('stays quiet after recent contact unless urgent', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    expect(shouldStayQuiet({
      now,
      lastContactedAt: new Date('2026-01-01T06:00:00Z'),
      quietHours: { startHour: 23, endHour: 8, timezone: 'UTC' },
      urgentSignals: [],
    })).toBe(true);
    expect(shouldStayQuiet({
      now,
      lastContactedAt: new Date('2026-01-01T03:00:00Z'),
      quietHours: { startHour: 23, endHour: 8, timezone: 'UTC' },
      urgentSignals: [],
    })).toBe(false);
  });
});

describe('parseCheckInResponse', () => {
  it('suppresses empty and NO_CHECK_IN_NEEDED replies', () => {
    expect(parseCheckInResponse('NO_CHECK_IN_NEEDED').deliver).toBe(false);
    expect(parseCheckInResponse('  ').deliver).toBe(false);
    expect(parseCheckInResponse('New email needs review').deliver).toBe(true);
  });
});

describe('buildCheckInPrompt', () => {
  it('advances rotation and wraps', async () => {
    const state: CheckInState = { key: 'cli', lastChecks: {}, rotationPosition: 3 };

    const result = await buildCheckInPrompt({ state, source: 'cli', projectPath: '/tmp/project' });

    expect(result.nextState.rotationPosition).toBe(0);
    expect(result.prompt).toContain('Proactive check-in cycle');
  });

  it('does not invoke project status for gateway sources', async () => {
    const project = await import('./checks/project-status-check.js');
    vi.mocked(project.checkProjectStatus).mockClear();
    const state: CheckInState = { key: 'web', lastChecks: {}, rotationPosition: 2 };

    await buildCheckInPrompt({ state, source: 'web', projectPath: '/tmp/project' });

    expect(project.checkProjectStatus).not.toHaveBeenCalled();
  });

  it('includes HEARTBEAT.md guidance when provided', async () => {
    const state: CheckInState = { key: 'cli', lastChecks: {}, rotationPosition: 0 };
    const result = await buildCheckInPrompt({
      state,
      source: 'cli',
      heartbeatGuidance: 'Check email and calendar mentions.',
    });
    expect(result.prompt).toContain('HEARTBEAT.md guidance');
    expect(result.prompt).toContain('Check email and calendar mentions.');
  });
});
