import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { workspaceSsoProviders } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getDecryptedClientSecret } from '@/lib/sso/workspace-sso';
import { discoverOidc, generatePkce, generateState, buildAuthorizationUrl } from '@/lib/sso/oidc-client';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const ALLOWED_RETURN_PATHS = /^\/[a-zA-Z0-9/_\-?=&#.%]*$/;

const authorizeSchema = z.object({
  providerId: z.string().uuid(),
  returnTo: z.string().optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = authorizeSchema.safeParse({
    providerId: url.searchParams.get('providerId'),
    returnTo: url.searchParams.get('returnTo') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const returnTo = parsed.data.returnTo && ALLOWED_RETURN_PATHS.test(parsed.data.returnTo)
    ? parsed.data.returnTo
    : '/launcher';

  const [provider] = await db
    .select()
    .from(workspaceSsoProviders)
    .where(and(eq(workspaceSsoProviders.id, parsed.data.providerId), eq(workspaceSsoProviders.enabled, true)))
    .limit(1);

  if (!provider || provider.providerType !== 'oidc') {
    return NextResponse.json({ error: 'SSO provider not found or not available.' }, { status: 404 });
  }

  const clientSecret = getDecryptedClientSecret(provider);
  if (!provider.clientId || !provider.issuer || !clientSecret) {
    return NextResponse.json({ error: 'SSO provider is misconfigured.' }, { status: 500 });
  }

  const discovery = await discoverOidc(provider.issuer).catch(() => null);
  if (!discovery) {
    return NextResponse.json({ error: 'Failed to reach SSO provider. Check the issuer URL.' }, { status: 502 });
  }

  const { verifier, challenge } = generatePkce();
  const state = generateState();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:4100';
  const redirectUri = `${appUrl}/api/auth/sso/callback`;

  const statePayload = JSON.stringify({
    state,
    providerId: provider.id,
    verifier,
    returnTo,
    tokenEndpoint: discovery.token_endpoint,
    userInfoEndpoint: discovery.userinfo_endpoint ?? null,
  });

  const cookieStore = await cookies();
  cookieStore.set('sso_state', statePayload, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 10,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  });

  const authUrl = buildAuthorizationUrl({
    authorizationEndpoint: discovery.authorization_endpoint,
    clientId: provider.clientId,
    redirectUri,
    state,
    codeChallenge: challenge,
  });

  return NextResponse.redirect(authUrl);
}
