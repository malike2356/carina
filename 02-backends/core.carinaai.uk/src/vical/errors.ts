import type { VcalOfferedSlot } from './types.js';

export class VcalError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'VcalError';
    this.code = code;
    this.details = details;
  }
}

export class SlotUnavailableError extends VcalError {
  readonly alternatives: VcalOfferedSlot[];

  constructor(message: string, alternatives: VcalOfferedSlot[] = []) {
    super('slot_unavailable', message, { alternatives });
    this.name = 'SlotUnavailableError';
    this.alternatives = alternatives;
  }
}

export function isVcalError(error: unknown): error is VcalError {
  return error instanceof VcalError;
}
