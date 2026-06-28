import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession, requireWorkspace } from '@/lib/session';
import { updateSsoProvider, deleteSsoProvider } from '@/lib/sso/workspace-sso';
import { validateCertificatePem } from '@/lib/sso/saml-client';
import { writeAuditLog } from '@/lib/audit';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  enabled: z.boolean().optional(),
  defaultRole: z.enum(['member', 'admin']).optional(),
  ssoRequired: z.boolean().optional(),
  clientId: z.string().min(1).optional(),
  clientSecret: z.string().min(1).optional(),
  issuer: z.string().url().optional(),
  samlEntityId: z.string().min(1).optional(),
  samlSsoUrl: z.string().url().optional(),
  samlCertificate: z.string().min(10).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  if (workspace.userId !== session.user.id) {
    return NextResponse.json({ error: 'Only workspace owners can manage SSO providers.' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', issues: parsed.error.issues }, { status: 400 });
  }

  if (parsed.data.samlCertificate && !validateCertificatePem(parsed.data.samlCertificate)) {
    return NextResponse.json({ error: 'Invalid SAML certificate.' }, { status: 400 });
  }

  const updated = await updateSsoProvider(id, workspace.id, parsed.data);
  if (!updated) {
    return NextResponse.json({ error: 'Provider not found.' }, { status: 404 });
  }

  const ip = (await headers()).get('x-forwarded-for') ?? undefined;
  const action = parsed.data.enabled === false
    ? 'sso.provider.disabled'
    : parsed.data.ssoRequired !== undefined
      ? 'sso.policy.updated'
      : 'sso.provider.updated';
  await writeAuditLog({
    workspaceId: workspace.id,
    userId: session.user.id,
    action,
    detail: { providerId: id, changes: Object.keys(parsed.data) },
    ip,
  });

  const { clientSecretEnc, clientSecretIv, clientSecretTag, samlCertificateEnc, samlCertificateIv, samlCertificateTag, ...safeProvider } = updated;
  return NextResponse.json({ data: safeProvider });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  if (workspace.userId !== session.user.id) {
    return NextResponse.json({ error: 'Only workspace owners can manage SSO providers.' }, { status: 403 });
  }

  const { id } = await params;
  const deleted = await deleteSsoProvider(id, workspace.id);
  if (!deleted) {
    return NextResponse.json({ error: 'Provider not found.' }, { status: 404 });
  }

  const ip = (await headers()).get('x-forwarded-for') ?? undefined;
  await writeAuditLog({
    workspaceId: workspace.id,
    userId: session.user.id,
    action: 'sso.provider.deleted',
    detail: { providerId: id },
    ip,
  });

  return NextResponse.json({ success: true });
}
