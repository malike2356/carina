import type { LegalGatePayload } from './legal-gate';

export class LegalGateRequiredError extends Error {
  readonly gate: LegalGatePayload;

  constructor(gate: LegalGatePayload) {
    super('legal_acceptance_required');
    this.name = 'LegalGateRequiredError';
    this.gate = gate;
  }
}
