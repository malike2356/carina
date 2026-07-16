export type SocialOAuthProvider = 'linkedin' | 'meta' | 'twitter' | 'tiktok';

export const SOCIAL_OAUTH_STUB_BODY = {
  error: 'Social OAuth not configured',
  code: 'NOT_IMPLEMENTED',
} as const;

export function aivaSocialOAuthRedirectUri(
  request: Request,
  provider: SocialOAuthProvider,
): string {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || new URL(request.url).origin;
  return `${origin}/api/aiva/social/oauth/${provider}/callback`;
}
