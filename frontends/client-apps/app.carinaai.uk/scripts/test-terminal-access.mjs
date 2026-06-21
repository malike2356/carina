import assert from 'node:assert/strict';

function evaluateTerminalAccess(input) {
  if (!input.terminalEnabled) return false;
  if (input.isOwner) return true;
  return input.memberTerminal === true;
}

assert.equal(
  evaluateTerminalAccess({ terminalEnabled: false, isOwner: true }),
  false,
  'owner blocked when workspace terminal disabled',
);

assert.equal(
  evaluateTerminalAccess({ terminalEnabled: true, isOwner: true }),
  true,
  'owner allowed when workspace terminal enabled',
);

assert.equal(
  evaluateTerminalAccess({ terminalEnabled: true, isOwner: false, memberTerminal: false }),
  false,
  'member blocked without explicit permission',
);

assert.equal(
  evaluateTerminalAccess({ terminalEnabled: true, isOwner: false, memberTerminal: true }),
  true,
  'member allowed with explicit permission',
);

assert.equal(
  evaluateTerminalAccess({ terminalEnabled: false, isOwner: false, memberTerminal: true }),
  false,
  'member permission ignored when workspace terminal disabled',
);

console.log('terminal-access policy: ok');
