import { setShieldMode } from '../security/session-shield.js';
import {
  applySurfaceRestriction,
  DEFAULT_RISK_TRANSITION_RULES,
  type RiskTransitionRule,
  type SurfaceRestriction,
} from '../security/attack-surface.js';
import type { ShieldMode } from '../security/policy-decisions.js';

export type RiskTrigger =
  | 'repeated_injection'
  | 'unknown_tool'
  | 'risky_chain'
  | 'suspicious_egress';

export interface RiskTransitionInput {
  trigger: RiskTrigger;
  sessionId: string;
  instanceId: string;
  reason: string;
  metadata?: Record<string, unknown>;
}

export interface RiskTransitionResult {
  applied: boolean;
  actions: string[];
  recommendedOnly: boolean;
}

let rules: RiskTransitionRule[] = [...DEFAULT_RISK_TRANSITION_RULES];

export function getRiskTransitionRules(): RiskTransitionRule[] {
  return [...rules];
}

export function setRiskTransitionRules(newRules: RiskTransitionRule[]): void {
  rules = newRules;
}

export function resetRiskTransitionRules(): void {
  rules = [...DEFAULT_RISK_TRANSITION_RULES];
}

export async function handleRiskTransition(
  input: RiskTransitionInput,
): Promise<RiskTransitionResult> {
  const rule = rules.find((r) => r.trigger === input.trigger);
  if (!rule) {
    return { applied: false, actions: ['escalate_to_operator'], recommendedOnly: true };
  }

  const actions: string[] = [];
  if (!rule.autoApply) {
    if (rule.targetMode) actions.push(`recommend_shield_${rule.targetMode}`);
    if (rule.restrictions?.length) {
      actions.push(...rule.restrictions.map((r) => `recommend_restrict_${r}`));
    }
    return { applied: false, actions, recommendedOnly: true };
  }

  if (rule.targetMode) {
    await setShieldMode(input.sessionId, rule.targetMode as ShieldMode, 'auto-remediation', input.reason);
    actions.push(`shield_mode_${rule.targetMode}`);
  }

  if (rule.restrictions) {
    for (const restriction of rule.restrictions) {
      await applySurfaceRestriction({
        instanceId: input.instanceId,
        sessionId: input.sessionId,
        restriction: restriction as SurfaceRestriction,
        reason: input.reason,
        appliedBy: 'auto-remediation',
        durationSeconds: 1800,
      });
      actions.push(`restrict_${restriction}`);
    }
  }

  return { applied: true, actions, recommendedOnly: false };
}
