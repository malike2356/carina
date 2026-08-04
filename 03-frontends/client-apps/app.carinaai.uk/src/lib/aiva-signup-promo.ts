import { aivaAppOrigin } from '@/lib/product-surface';

/**
 * Partner / channel signup promos keyed by `?ref=`.
 * Product UI never names a specific partner; marketing copy lives outside the app.
 * Promo signup always lands on the Aiva host (Hire Aiva), not Carina Cloud.
 */

export type ClientSignupPromo = {
  code: string;
  trialMessages: number;
  trialDays: number;
  defaultTemplateId: string;
  firstActionPrompt: string;
};

/** Keep the registry in sync with core `src/billing/signup-promo.ts`. */
const SIGNUP_PROMOS: Record<string, ClientSignupPromo> = {
  ipn: {
    code: 'ipn',
    trialMessages: 500,
    trialDays: 30,
    defaultTemplateId: 'property-manager',
    firstActionPrompt:
      'Give me a quick sample of what you can do. Show a short daily brief covering three tasks or priorities.',
  },
};

export const AIVA_SIGNUP_REF_COOKIE = 'aiva_signup_ref';

export function normalizeSignupRef(raw: string | null | undefined): string | null {
  const value = raw?.trim().toLowerCase();
  if (!value) return null;
  if (value.length > 64) return null;
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(value)) return null;
  return value;
}

export function getSignupPromo(raw: string | null | undefined): ClientSignupPromo | null {
  const code = normalizeSignupRef(raw);
  if (!code) return null;
  return SIGNUP_PROMOS[code] ?? null;
}

export function promoFromSearchParams(
  searchParams: Pick<URLSearchParams, 'get'>,
): ClientSignupPromo | null {
  const fromRef = getSignupPromo(searchParams.get('ref'));
  if (fromRef) return fromRef;
  const template = searchParams.get('template')?.trim().toLowerCase();
  if (!template) return fromRef;
  return fromRef;
}

export function buildPromoRegisterPath(code: string): string {
  const promo = getSignupPromo(code);
  if (!promo) return '/register';
  return `/register?ref=${encodeURIComponent(promo.code)}&template=${encodeURIComponent(promo.defaultTemplateId)}`;
}

/** Absolute Aiva-host URL for emails, posts, and Cloud redirects. */
export function buildPromoRegisterUrl(code: string): string {
  return `${aivaAppOrigin()}${buildPromoRegisterPath(code)}`;
}

export function buildPromoOnboardingPath(code: string): string {
  return `/onboarding?ref=${encodeURIComponent(code)}`;
}

export function setClientSignupRefCookie(code: string): void {
  if (typeof document === 'undefined') return;
  const normalized = normalizeSignupRef(code);
  if (!normalized) return;
  document.cookie = `${AIVA_SIGNUP_REF_COOKIE}=${encodeURIComponent(normalized)}; path=/; max-age=2592000; samesite=lax`;
}

export function clearClientSignupRefCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${AIVA_SIGNUP_REF_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

export function readClientSignupPromo(): ClientSignupPromo | null {
  if (typeof document === 'undefined') return null;
  const raw = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AIVA_SIGNUP_REF_COOKIE}=`));
  if (!raw) return null;
  const value = raw.slice(AIVA_SIGNUP_REF_COOKIE.length + 1);
  try {
    return getSignupPromo(decodeURIComponent(value));
  } catch {
    return getSignupPromo(value);
  }
}

export async function ensurePromoTrialProvisioned(code: string): Promise<void> {
  await fetch('/api/aiva/subscription/trial', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signupSource: code, sendWelcome: true }),
  }).catch(() => undefined);
}
