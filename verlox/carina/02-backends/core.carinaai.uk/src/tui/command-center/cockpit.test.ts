import { describe, expect, it } from 'vitest';
import { buildCockpitState, cockpitLine } from './cockpit.js';

describe('Command Center cockpit', () => {
  it('maps runtime input into scannable cockpit state', () => {
    const state = buildCockpitState({
      sessionId: 'abcdef123456',
      model: 'deepseek-chat',
      connection: 'online',
      streaming: false,
      queued: 0,
      activeAgents: 2,
      scoutLinked: true,
      scoutTrust: 91,
      pendingApprovals: 1,
      tokenCount: 1200,
      mode: 'approval',
    });

    expect(state.sessionLabel).toBe('abcdef12');
    expect(state.connectionLabel).toBe('Connected');
    expect(state.scoutLabel).toBe('Scout 91/100');
    expect(state.approvalLabel).toBe('1 approval');
    expect(state.hints).toContain('Approve');
  });

  it('handles empty, loading, offline, degraded, and error states', () => {
    expect(buildCockpitState({
      connection: 'connecting',
      streaming: false,
      queued: 0,
      activeAgents: 0,
      pendingApprovals: 0,
      tokenCount: 0,
      mode: 'chat',
    }).connectionLabel).toBe('Connecting');

    expect(buildCockpitState({
      connection: 'degraded',
      streaming: false,
      queued: 3,
      activeAgents: 0,
      scoutLinked: false,
      pendingApprovals: 0,
      tokenCount: 0,
      mode: 'debug',
    }).connectionTone).toBe('warning');
  });

  it('renders bounded lines for narrow terminals', () => {
    const state = buildCockpitState({
      sessionId: 'abcdef123456',
      model: 'deepseek-chat',
      connection: 'online',
      streaming: true,
      queued: 0,
      activeAgents: 0,
      scoutLinked: false,
      pendingApprovals: 0,
      tokenCount: 20,
      mode: 'chat',
    });
    expect(cockpitLine(state, 40).length).toBeLessThanOrEqual(40);
  });
});
