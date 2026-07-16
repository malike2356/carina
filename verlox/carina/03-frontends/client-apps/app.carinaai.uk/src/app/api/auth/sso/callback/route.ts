import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { db } from '@/db';
import { workspaceSsoProviders } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getDecryptedClientSecret } from '@/lib/sso/workspace-sso';
import {
  decodeJwtPayload,
  exchangeCodeForTokens,
  fetchUserInfo,
} from '@/lib/sso/oidc-client';
import { provisionSsoUser } from '@/lib/sso/provisioning';
import { emailDomainMatchesProvider } from '@/lib/sso/policy';
import { redirectWithAuthSession } from '@/lib/sso/session-bridge';
import { writeAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

interface SsoStatePayload {
  state: string;
  providerId: string;
  verifier: string;
  returnTo: string;
  tokenEndpoint: string;
  userInfoEndpoint: string | null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:4100';
  const ip = (await headers()).get('x-forwarded-for') ?? undefined;

  if (error) {
    await writeAuditLog({
      workspaceId: 'platform',
      action: 'sso.login.failed',
      detail: { reason: error },
      ip,
    }).catch(() => {});
    return NextResponse.redirect(new URL(`/login?error=sso_${error}`, appUrl));
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(new URL('/login?error=sso_invalid', appUrl));
  }

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get('sso_state')?.value;
  if (!stateCookie) {
    return NextResponse.redirect(new URL('/login?error=sso_expired', appUrl));
  }

  let statePayload: SsoStatePayload;
  try {
    statePayload = JSON.parse(stateCookie) as SsoStatePayload;
  } catch {
    return NextResponse.redirect(new URL('/login?error=sso_expired', appUrl));
  }

  if (statePayload.state !== stateParam) {
    return NextResponse.redirect(new URL('/login?error=sso_state', appUrl));
  }

  cookieStore.delete('sso_state');

  const [provider] = await db
    .select()
    .from(workspaceSsoProviders)
    .where(eq(workspaceSsoProviders.id, statePayload.providerId))
    .limit(1);

  if (!provider || provider.providerType !== 'oidc' || !provider.enabled) {
    return NextResponse.redirect(new URL('/login?error=sso_provider', appUrl));
  }

  const clientSecret = getDecryptedClientSecret(provider);
  if (!provider.clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/login?error=sso_config', appUrl));
  }

  const redirectUri = `${appUrl}/api/auth/sso/callback`;

  try {
    const tokens = await exchangeCodeForTokens({
      tokenEndpoint: statePayload.tokenEndpoint,
      clientId: provider.clientId,
      clientSecret,
      redirectUri,
      code,
      codeVerifier: statePayload.verifier,
    });

    let identity: { sub: string; email?: string; name?: string; email_verified?: boolean };
    if (statePayload.userInfoEndpoint) {
      identity = await fetchUserInfo(statePayload.userInfoEndpoint, tokens.access_token);
    } else if (tokens.id_token) {
      identity = decodeJwtPayload(tokens.id_token) as typeof identity;
    } else {
      throw new Error('No user info available');
    }

    const email = typeof identity.email === 'string' ? identity.email : '';
    const sub = typeof identity.sub === 'string' ? identity.sub : '';
    if (!email || !sub) {
      throw new Error('Missing email or subject from IdP');
    }

    if (!emailDomainMatchesProvider(email, provider.domain)) {
      await writeAuditLog({
        workspaceId: provider.workspaceId,
        action: 'sso.login.blocked_by_policy',
        detail: { reason: 'email_domain_mismatch', emailDomain: email.split('@')[1] },
        ip,
      }).catch(() => {});
      return NextResponse.redirect(new URL('/login?error=sso_domain', appUrl));
    }

    const result = await provisionSsoUser(
      {
        sub,
        email,
        name: typeof identity.name === 'string' ? identity.name : undefined,
        emailVerified: identity.email_verified ?? true,
      },
      provider,
      ip,
    );

    await writeAuditLog({
      workspaceId: provider.workspaceId,
      userId: result.userId,
      action: 'sso.login.succeeded',
      detail: { providerId: provider.id, isNew: result.isNew },
      ip,
    }).catch(() => {});

    return redirectWithAuthSession(result.userId, statePayload.returnTo);
  } catch (err) {
    await writeAuditLog({
      workspaceId: provider.workspaceId,
      action: 'sso.login.failed',
      detail: { providerId: provider.id, message: err instanceof Error ? err.message : 'unknown' },
      ip,
    }).catch(() => {});
    return NextResponse.redirect(new URL('/login?error=sso_failed', appUrl));
  }
}
