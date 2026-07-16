/** After Aiva sign-in, run onboarding resume so returning users get the cookie before /aiva. */
export const AIVA_POST_AUTH_PATH = '/api/workspace/onboarding-resume';
export const AIVA_DEFAULT_SIGNED_IN_PATH = '/aiva/workers';

export function resolveAivaPostAuthPath(callbackUrl: string | null | undefined): string {
  const value = callbackUrl?.trim();
  if (!value || !value.startsWith('/')) return AIVA_POST_AUTH_PATH;
  if (value === '/aiva' || value.startsWith('/aiva/')) return AIVA_POST_AUTH_PATH;
  return value;
}

export function resolveAivaSignedInPath(workspace: {
  onboardingCompletedAt?: Date | string | null;
}): string {
  return workspace.onboardingCompletedAt ? AIVA_DEFAULT_SIGNED_IN_PATH : '/onboarding';
}
