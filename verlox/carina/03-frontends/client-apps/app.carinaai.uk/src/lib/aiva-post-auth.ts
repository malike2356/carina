/** After Aiva sign-in, run onboarding resume so returning users get the cookie before /aiva. */
export const AIVA_POST_AUTH_PATH = '/api/workspace/onboarding-resume';
export const AIVA_DEFAULT_SIGNED_IN_PATH = '/aiva';

export function resolveAivaPostAuthPath(callbackUrl: string | null | undefined): string {
  const value = callbackUrl?.trim();
  if (!value || !value.startsWith('/')) return AIVA_POST_AUTH_PATH;
  if (value === '/aiva' || value.startsWith('/aiva/')) return AIVA_POST_AUTH_PATH;
  return value;
}

export function resolveAivaSignedInPath(opts: {
  onboardingCompletedAt?: Date | string | null;
}): string {
  if (!opts.onboardingCompletedAt) return '/aiva';
  return AIVA_DEFAULT_SIGNED_IN_PATH;
}
