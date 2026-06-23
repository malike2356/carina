import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { customDomains } from '@/db/schema';
import {
  buildVerificationToken,
  domainVerificationInstructions,
  normaliseCustomDomainHostname,
} from '@/lib/custom-domains';
import { listWorkspaceDomains } from '@/lib/host-resolver';
import { isWorkspaceOwner } from '@/lib/terminal-access';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

function serializeDomain(row: typeof customDomains.$inferSelect) {
  const instructions = domainVerificationInstructions(row.hostname, row.verificationToken);
  return {
    id: row.id,
    hostname: row.hostname,
    verifiedAt: row.verifiedAt,
    tlsStatus: row.tlsStatus,
    isCanonical: row.isCanonical,
    createdAt: row.createdAt,
    ...instructions,
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const domains = await listWorkspaceDomains(workspace.id);
  return NextResponse.json({ data: domains.map(serializeDomain) });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  if (!await isWorkspaceOwner(workspace.id, session.user.id)) {
    return NextResponse.json({ error: 'Only the workspace owner can manage custom domains' }, { status: 403 });
  }

  const body = (await request.json()) as { hostname?: string };
  const hostname = normaliseCustomDomainHostname(String(body.hostname ?? ''));
  if (!hostname || hostname.includes('/')) {
    return NextResponse.json({ error: 'Invalid hostname' }, { status: 400 });
  }

  const token = buildVerificationToken();
  const [row] = await db
    .insert(customDomains)
    .values({
      workspaceId: workspace.id,
      hostname,
      verificationToken: token,
    })
    .returning();

  return NextResponse.json({ data: serializeDomain(row) }, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  if (!await isWorkspaceOwner(workspace.id, session.user.id)) {
    return NextResponse.json({ error: 'Only the workspace owner can manage custom domains' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const domainId = searchParams.get('id');
  if (!domainId) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const deleted = await db
    .delete(customDomains)
    .where(eq(customDomains.id, domainId))
    .returning({ id: customDomains.id, workspaceId: customDomains.workspaceId });

  if (!deleted[0] || deleted[0].workspaceId !== workspace.id) {
    return NextResponse.json({ error: 'Custom domain not found' }, { status: 404 });
  }

  return NextResponse.json({ data: { ok: true } });
}
