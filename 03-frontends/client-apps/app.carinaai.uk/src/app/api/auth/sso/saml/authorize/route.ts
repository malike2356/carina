import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { workspaceSsoProviders } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getDecryptedSamlCertificate } from '@/lib/sso/workspace-sso';
import { getSamlAuthorizeUrl } from '@/lib/sso/saml-client';
import crypto from 'node:crypto';

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

  if (!provider || provider.providerType !== 'saml') {
    return NextResponse.json({ error: 'SSO provider not found or not available.' }, { status: 404 });
  }

  if (!provider.samlSsoUrl || !getDecryptedSamlCertificate(provider)) {
    return NextResponse.json({ error: 'SAML provider is misconfigured.' }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:4100';
  const acsUrl = `${appUrl}/api/auth/sso/saml/acs`;
  const relayState = JSON.stringify({
    providerId: provider.id,
    returnTo,
    nonce: crypto.randomBytes(16).toString('hex'),
  });

  const cookieStore = await cookies();
  cookieStore.set('sso_saml_relay', relayState, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 10,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  });

  try {
    const authUrl = await getSamlAuthorizeUrl(provider, acsUrl);
    const redirectUrl = new URL(authUrl);
    redirectUrl.searchParams.set('RelayState', relayState);
    return NextResponse.redirect(redirectUrl.toString());
  } catch {
    return NextResponse.json({ error: 'Failed to start SAML sign-in.' }, { status: 502 });
  }
}
