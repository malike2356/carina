'use client';

function setShortCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=1800; samesite=lax`;
}

export function primeGoogleLoginCookies(returnTo: string): void {
  setShortCookie('google_auth_mode', 'login');
  setShortCookie('google_auth_return_to', returnTo);
}

export function primeGoogleSignupCookies(input: {
  returnTo?: string;
  termsAccepted: boolean;
  aivaTrial?: boolean;
  signupRef?: string;
}): void {
  if (input.termsAccepted) {
    setShortCookie('google_signup_terms', '1');
  }
  if (input.aivaTrial) {
    setShortCookie('aiva_signup_pending', '1');
  }
  if (input.signupRef) {
    setShortCookie('aiva_signup_ref', input.signupRef);
  }
  if (input.returnTo) {
    setShortCookie('google_auth_return_to', input.returnTo);
  }
}

export const GOOGLE_AUTH_COMPLETE_PATH = '/auth/google-complete';
