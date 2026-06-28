import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession, requireWorkspace } from '@/lib/session';
import {
  listSsoProviders,
  createOidcProvider,
  createSamlProvider,
  isPublicDomain,
  normalizeDomain,
} from '@/lib/sso/workspace-sso';
import { validateCertificatePem } from '@/lib/sso/saml-client';
import { writeAuditLog } from '@/lib/audit';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

const createOidcSchema = z.object({
  providerType: z.literal('oidc'),
  displayName: z.string().min(1).max(100),
  domain: z.string().min(3).max(255),
  issuer: z.string().url(),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  defaultRole: z.enum(['member', 'admin']).optional(),
  enabled: z.boolean().optional(),
});

const createSamlSchema = z.object({
  providerType: z.literal('saml'),
  displayName: z.string().min(1).max(100),
  domain: z.string().min(3).max(255),
  entityId: z.string().min(1),
  ssoUrl: z.string().url(),
  certificate: z.string().min(10),
  defaultRole: z.enum(['member', 'admin']).optional(),
  enabled: z.boolean().optional(),
});

const createSchema = z.discriminatedUnion('providerType', [createOidcSchema, createSamlSchema]);

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const providers = await listSsoProviders(workspace.id);

  return NextResponse.json({ data: providers });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);

  if (workspace.userId !== session.user.id) {
    return NextResponse.json({ error: 'Only workspace owners can manage SSO providers.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', issues: parsed.error.issues }, { status: 400 });
  }

  const domain = normalizeDomain(
    parsed.data.providerType === 'oidc' ? parsed.data.domain : parsed.data.domain,
  );
  if (isPublicDomain(domain)) {
    return NextResponse.json({ error: 'Public email domains cannot be configured as SSO domains.' }, { status: 400 });
  }

  const ip = (await headers()).get('x-forwarded-for') ?? undefined;

  let provider;
  if (parsed.data.providerType === 'oidc') {
    provider = await createOidcProvider({
      workspaceId: workspace.id,
      displayName: parsed.data.displayName,
      domain,
      issuer: parsed.data.issuer,
      clientId: parsed.data.clientId,
      clientSecret: parsed.data.clientSecret,
      defaultRole: parsed.data.defaultRole,
      enabled: parsed.data.enabled,
      createdByUserId: session.user.id,
    });
  } else {
    if (!validateCertificatePem(parsed.data.certificate)) {
      return NextResponse.json({ error: 'Invalid SAML certificate.' }, { status: 400 });
    }
    provider = await createSamlProvider({
      workspaceId: workspace.id,
      displayName: parsed.data.displayName,
      domain,
      entityId: parsed.data.entityId,
      ssoUrl: parsed.data.ssoUrl,
      certificate: parsed.data.certificate,
      defaultRole: parsed.data.defaultRole,
      enabled: parsed.data.enabled,
      createdByUserId: session.user.id,
    });
  }

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: session.user.id,
    action: 'sso.provider.created',
    detail: { providerId: provider.id, providerType: provider.providerType, domain: provider.domain },
    ip,
  });

  const { clientSecretEnc, clientSecretIv, clientSecretTag, samlCertificateEnc, samlCertificateIv, samlCertificateTag, ...safeProvider } = provider;
  return NextResponse.json({ data: safeProvider }, { status: 201 });
}
