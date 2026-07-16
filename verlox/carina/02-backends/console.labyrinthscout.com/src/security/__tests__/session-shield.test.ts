import { afterEach, describe, expect, it } from 'vitest';
import {
  getShieldMode,
  isToolAllowedInShieldMode,
  requiresApprovalInGuardMode,
  resetShieldModesForTests,
  setShieldMode,
} from '../session-shield.js';

describe('SessionShield', () => {
  afterEach(() => resetShieldModesForTests());

  it('defaults to observe mode', async () => {
    const state = await getShieldMode('new-session');
    expect(state.mode).toBe('observe');
  });

  it('persists shield mode changes in memory', async () => {
    await setShieldMode('sess-a', 'guard', 'operator', 'elevated risk');
    const state = await getShieldMode('sess-a');
    expect(state.mode).toBe('guard');
    expect(state.reason).toBe('elevated risk');
    expect(state.changedBy).toBe('operator');
  });

  it('blocks all tools in quarantine mode', async () => {
    const check = await isToolAllowedInShieldMode('web-search', 'quarantine');
    expect(check.allowed).toBe(false);
  });

  it('blocks dangerous tools in restrict mode', async () => {
    const shell = await isToolAllowedInShieldMode('shell-exec', 'restrict');
    expect(shell.allowed).toBe(false);
    const search = await isToolAllowedInShieldMode('web-search', 'restrict');
    expect(search.allowed).toBe(true);
  });

  it('requires approval for risky tools in guard mode', () => {
    expect(requiresApprovalInGuardMode('file-write', 'guard')).toBe(true);
    expect(requiresApprovalInGuardMode('web-search', 'guard')).toBe(false);
    expect(requiresApprovalInGuardMode('file-write', 'observe')).toBe(false);
  });

  it('transitions through shield modes', async () => {
    await setShieldMode('sess-b', 'observe', 'system');
    expect((await getShieldMode('sess-b')).mode).toBe('observe');
    await setShieldMode('sess-b', 'guard', 'operator');
    expect((await getShieldMode('sess-b')).mode).toBe('guard');
    await setShieldMode('sess-b', 'restrict', 'auto-remediation');
    expect((await getShieldMode('sess-b')).mode).toBe('restrict');
    await setShieldMode('sess-b', 'quarantine', 'operator');
    expect((await getShieldMode('sess-b')).mode).toBe('quarantine');
  });
});
