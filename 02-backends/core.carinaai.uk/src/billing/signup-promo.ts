/**
 * Partner / channel signup promos keyed by `?ref=` (or signup_source).
 * Add or remove a promo here; product UI never names a specific partner.
 */

export type SignupPromo = {
  code: string;
  trialMessages: number;
  trialCreditGbp: number;
  trialDailyCapGbp: number;
  trialDays: number;
  /** Auto-hire this role template and skip the full hire wizard. */
  defaultTemplateId: string | null;
  /** Prefill first worker chat with this prompt after hire. */
  firstActionPrompt: string | null;
};

const SIGNUP_PROMOS: Record<string, SignupPromo> = {
  ipn: {
    code: 'ipn',
    trialMessages: 500,
    trialCreditGbp: 25,
    trialDailyCapGbp: 10,
    trialDays: 30,
    defaultTemplateId: 'property-manager',
    firstActionPrompt:
      'Give me a sample daily property summary for a landlord with 3 rental units. Keep it short and practical.',
  },
};

export function normalizeSignupSource(raw: string | null | undefined): string | null {
  const value = raw?.trim().toLowerCase();
  if (!value) return null;
  if (value.length > 64) return null;
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(value)) return null;
  return value;
}

export function getSignupPromo(raw: string | null | undefined): SignupPromo | null {
  const code = normalizeSignupSource(raw);
  if (!code) return null;
  return SIGNUP_PROMOS[code] ?? null;
}

export function listSignupPromoCodes(): string[] {
  return Object.keys(SIGNUP_PROMOS);
}
