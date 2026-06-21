import { afterEach, describe, expect, it } from 'vitest';
import {
  isGlobalPlanMode,
  isSessionPlanMode,
  resolvePlanMode,
  resetPlanModeStateForTests,
  setGlobalPlanMode,
  setSessionPlanMode,
} from './plan-mode-state.js';

describe('plan mode state', () => {
  afterEach(() => {
    resetPlanModeStateForTests();
  });

  it('tracks session plan mode', () => {
    expect(isSessionPlanMode('sess-1')).toBe(false);
    setSessionPlanMode('sess-1', true);
    expect(isSessionPlanMode('sess-1')).toBe(true);
    setSessionPlanMode('sess-1', false);
    expect(isSessionPlanMode('sess-1')).toBe(false);
  });

  it('tracks global plan mode', () => {
    expect(isGlobalPlanMode()).toBe(false);
    setGlobalPlanMode(true);
    expect(resolvePlanMode({})).toBe(true);
  });

  it('enables plan mode for non-admin hosted roles', () => {
    expect(resolvePlanMode({ orgRole: 'viewer' })).toBe(true);
    expect(resolvePlanMode({ orgRole: 'admin' })).toBe(false);
  });

  it('prefers explicit session plan mode for admins', () => {
    setSessionPlanMode('sess-admin', true);
    expect(resolvePlanMode({ sessionId: 'sess-admin', orgRole: 'admin' })).toBe(true);
  });
});
