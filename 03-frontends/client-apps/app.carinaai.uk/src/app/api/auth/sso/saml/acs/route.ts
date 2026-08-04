import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { db } from '@/db';
import { workspaceSsoProviders } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { validateSamlPostResponse } from '@/lib/sso/saml-client';
import { provisionSsoUser } from '@/lib/sso/provisioning';
import { emailDomainMatchesProvider } from '@/lib/sso/policy';
import { redirectWithAuthSession } from '@/lib/sso/session-bridge';
import { writeAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

interface SamlRelayState {
  providerId: string;
  returnTo: string;
  nonce: string;
}

export async function POST(req: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:4100';
  const ip = (await headers()).get('x-forwarded-for') ?? undefined;
  const formData = await req.formData();
  const samlResponse = String(formData.get('SAMLResponse') ?? '');
  const relayStateRaw = String(formData.get('RelayState') ?? '');

  if (!samlResponse) {
    return NextResponse.redirect(new URL('/login?error=sso_invalid', appUrl));
  }

  const cookieStore = await cookies();
  const relayCookie = cookieStore.get('sso_saml_relay')?.value ?? relayStateRaw;
  cookieStore.delete('sso_saml_relay');

  let relay: SamlRelayState;
  try {
    relay = JSON.parse(relayCookie) as SamlRelayState;
  } catch {
    return NextResponse.redirect(new URL('/login?error=sso_expired', appUrl));
  }

  const [provider] = await db
    .select()
    .from(workspaceSsoProviders)
    .where(eq(workspaceSsoProviders.id, relay.providerId))
    .limit(1);

  if (!provider || provider.providerType !== 'saml' || !provider.enabled) {
    return NextResponse.redirect(new URL('/login?error=sso_provider', appUrl));
  }

  const acsUrl = `${appUrl}/api/auth/sso/saml/acs`;

  try {
    const { profile } = await validateSamlPostResponse(provider, acsUrl, {
      SAMLResponse: samlResponse,
      RelayState: relayStateRaw,
    });

    const email = String(
      profile.email
        ?? profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress']
        ?? profile.nameID
        ?? '',
    ).toLowerCase();

    const sub = String(profile.nameID ?? email);
    if (!email || !sub) {
      throw new Error('Missing email from SAML assertion');
    }

    if (!emailDomainMatchesProvider(email, provider.domain)) {
      await writeAuditLog({
        workspaceId: provider.workspaceId,
        action: 'sso.login.blocked_by_policy',
        detail: { reason: 'email_domain_mismatch' },
        ip,
      }).catch(() => {});
      return NextResponse.redirect(new URL('/login?error=sso_domain', appUrl));
    }

    const displayName = String(
      profile.displayName
        ?? profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name']
        ?? email.split('@')[0],
    );

    const result = await provisionSsoUser(
      { sub, email, name: displayName, emailVerified: true },
      provider,
      ip,
    );

    await writeAuditLog({
      workspaceId: provider.workspaceId,
      userId: result.userId,
      action: 'sso.login.succeeded',
      detail: { providerId: provider.id, providerType: 'saml', isNew: result.isNew },
      ip,
    }).catch(() => {});

    return redirectWithAuthSession(result.userId, relay.returnTo);
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
