import { describe, expect, it } from 'vitest';
import { evaluateTerminalAccess } from './terminal-access-policy';

describe('evaluateTerminalAccess', () => {
  it('denies when workspace terminal is disabled', () => {
    expect(evaluateTerminalAccess({
      terminalEnabled: false,
      isOwner: true,
    })).toBe(false);
    expect(evaluateTerminalAccess({
      terminalEnabled: false,
      isOwner: false,
      memberTerminal: true,
    })).toBe(false);
  });

  it('allows owners when terminal is enabled', () => {
    expect(evaluateTerminalAccess({
      terminalEnabled: true,
      isOwner: true,
    })).toBe(true);
  });

  it('requires explicit member permission for non-owners', () => {
    expect(evaluateTerminalAccess({
      terminalEnabled: true,
      isOwner: false,
    })).toBe(false);
    expect(evaluateTerminalAccess({
      terminalEnabled: true,
      isOwner: false,
      memberTerminal: false,
    })).toBe(false);
    expect(evaluateTerminalAccess({
      terminalEnabled: true,
      isOwner: false,
      memberTerminal: true,
    })).toBe(true);
  });
});
