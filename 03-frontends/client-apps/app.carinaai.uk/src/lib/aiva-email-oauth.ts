export function aivaEmailOAuthRedirectUri(request: Request, provider: 'gmail' | 'outlook'): string {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || new URL(request.url).origin;
  return `${origin}/api/aiva/email/oauth/${provider}/callback`;
}
