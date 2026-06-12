import { describe, expect, it } from 'vitest';
import { buildDefenseConsole, DEFENSE_CAPABILITIES } from '../defense-console.js';
import { listPolicyPacks } from '../../../security/policy-packs.js';
import { getRemediationRules } from '../../../security/auto-remediation.js';
import { getTripwireConfig } from '../../../security/tripwire-registry.js';
import { buildResponseTerminal } from '../response-terminal.js';

describe('buildDefenseConsole', () => {
  it('includes capability metadata with honest write flags', () => {
    const payload = buildDefenseConsole({
      shield: null,
      activePack: null,
      packs: listPolicyPacks(),
      grants: [],
      restrictions: [],
      remediationRules: getRemediationRules(),
      tripwireConfig: getTripwireConfig(),
      tripwireHits: [],
      terminal: buildResponseTerminal({
        riskScore: 10,
        shieldMode: 'observe',
        sessionId: 's1',
        blockedActions24h: 0,
        suspiciousTools: [],
        restrictions: [],
        grants: [],
        lastUnsafeEvent: null,
      }),
    });

    expect(payload.capabilities).toEqual(DEFENSE_CAPABILITIES);
    const tripwire = payload.capabilities.find((c) => c.id === 'tripwires');
    expect(tripwire?.write).toBe(false);
    const remediation = payload.capabilities.find((c) => c.id === 'auto_remediation');
    expect(remediation?.note).toContain('backend-configured');
  });
});
