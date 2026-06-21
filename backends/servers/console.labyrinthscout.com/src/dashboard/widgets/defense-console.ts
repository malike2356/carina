import type { PolicyPack } from '../../security/policy-packs.js';
import type { RemediationRule } from '../../security/auto-remediation.js';
import type { TripwireConfig, TripwireHit } from '../../security/tripwire-registry.js';
import type { ShieldModeState } from '../../security/policy-decisions.js';
import type { AppliedPolicyPack } from '../../security/policy-packs.js';
import type { JitGrant } from '../../security/jit-privileges.js';
import type { SurfaceRestrictionState } from '../../security/attack-surface.js';
import type { ResponseTerminalSummary } from './response-terminal.js';

export interface DefenseControlCapability {
  id: string;
  label: string;
  read: boolean;
  write: boolean;
  note?: string;
}

export interface DefenseConsolePayload {
  generated_at: string;
  capabilities: DefenseControlCapability[];
  shield: ShieldModeState | null;
  active_pack: AppliedPolicyPack | null;
  packs: PolicyPack[];
  grants: JitGrant[];
  restrictions: SurfaceRestrictionState[];
  remediation_rules: RemediationRule[];
  tripwire_config: TripwireConfig[];
  tripwire_hits: TripwireHit[];
  terminal: ResponseTerminalSummary | null;
}

export const DEFENSE_CAPABILITIES: DefenseControlCapability[] = [
  { id: 'shield_mode', label: 'Shield mode', read: true, write: true },
  { id: 'policy_packs', label: 'Policy packs', read: true, write: true },
  { id: 'jit_grants', label: 'JIT privileges', read: true, write: true },
  { id: 'simulation', label: 'Action simulation', read: true, write: true },
  {
    id: 'auto_remediation',
    label: 'Auto-remediation',
    read: true,
    write: true,
    note: 'Rule enable/disable is backend-configured; apply and rollback are operator-triggered only',
  },
  { id: 'tripwires', label: 'Tripwires', read: true, write: false, note: 'Read-only status; deployment via honeypot controls' },
  { id: 'surface_restrictions', label: 'Surface restrictions', read: true, write: true },
];

export function buildDefenseConsole(input: {
  shield: ShieldModeState | null;
  activePack: AppliedPolicyPack | null;
  packs: PolicyPack[];
  grants: JitGrant[];
  restrictions: SurfaceRestrictionState[];
  remediationRules: RemediationRule[];
  tripwireConfig: TripwireConfig[];
  tripwireHits: TripwireHit[];
  terminal: ResponseTerminalSummary | null;
  now?: Date;
}): DefenseConsolePayload {
  return {
    generated_at: (input.now ?? new Date()).toISOString(),
    capabilities: DEFENSE_CAPABILITIES,
    shield: input.shield,
    active_pack: input.activePack,
    packs: input.packs,
    grants: input.grants,
    restrictions: input.restrictions,
    remediation_rules: input.remediationRules,
    tripwire_config: input.tripwireConfig,
    tripwire_hits: input.tripwireHits,
    terminal: input.terminal,
  };
}
