import type { CapabilityGateResult } from './capability-gate.js';

export function formatRejection(gateResult: CapabilityGateResult & { allowed: false }): string {
  const { explanation, fix } = gateResult;
  return `${explanation}\n\n${fix}`;
}

export function gateRejectionToToolResponse(gateResult: CapabilityGateResult & { allowed: false }): Record<string, unknown> {
  return {
    error: formatRejection(gateResult),
    code: gateResult.reason.code,
    explanation: gateResult.explanation,
    fix: gateResult.fix,
    _gateRejection: gateResult.reason,
  };
}
