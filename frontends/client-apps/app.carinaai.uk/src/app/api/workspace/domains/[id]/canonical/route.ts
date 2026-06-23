import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { customDomains } from '@/db/schema';
import { isWorkspaceOwner } from '@/lib/terminal-access';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  if (!await isWorkspaceOwner(workspace.id, session.user.id)) {
    return NextResponse.json({ error: 'Only the workspace owner can set canonical domains' }, { status: 403 });
  }

  const { id } = await context.params;
  const [domain] = await db
    .select()
    .from(customDomains)
    .where(and(eq(customDomains.id, id), eq(customDomains.workspaceId, workspace.id)))
    .limit(1);

  if (!domain?.verifiedAt) {
    return NextResponse.json({ error: 'Domain must be verified before it can be canonical' }, { status: 400 });
  }

  await db
    .update(customDomains)
    .set({ isCanonical: false })
    .where(eq(customDomains.workspaceId, workspace.id));

  const [updated] = await db
    .update(customDomains)
    .set({ isCanonical: true })
    .where(eq(customDomains.id, domain.id))
    .returning();

  return NextResponse.json({ data: updated });
}
