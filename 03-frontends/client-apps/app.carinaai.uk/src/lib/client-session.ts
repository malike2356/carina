/** Client-side session cookie probe (better-auth default names). */
export function hasClientSessionCookie(): boolean {
  if (typeof document === 'undefined') return false;

  return document.cookie.split(';').some((part) => {
    const name = part.trim().split('=')[0]?.trim() ?? '';
    return name === 'better-auth.session_token'
      || name === '__Secure-better-auth.session_token'
      || name.startsWith('better-auth.session_token.');
  });
}
