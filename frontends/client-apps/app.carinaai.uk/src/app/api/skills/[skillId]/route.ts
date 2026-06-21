import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { workspaceSkills } from '@/db/schema';
import { getSession, requireWorkspace } from '@/lib/session';

type RouteContext = { params: Promise<{ skillId: string }> };

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const { skillId } = await context.params;
  const body = (await request.json()) as { enabled?: boolean };
  const enabled = typeof body.enabled === 'boolean' ? body.enabled : true;

  await db
    .insert(workspaceSkills)
    .values({
      workspaceId: workspace.id,
      skillId,
      enabled,
      isCustom: false,
    })
    .onConflictDoUpdate({
      target: [workspaceSkills.workspaceId, workspaceSkills.skillId],
      set: { enabled, updatedAt: new Date() },
    });

  return NextResponse.json({ data: { ok: true } });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const { skillId } = await context.params;

  await db
    .delete(workspaceSkills)
    .where(and(eq(workspaceSkills.workspaceId, workspace.id), eq(workspaceSkills.skillId, skillId)));

  return NextResponse.json({ data: { ok: true } });
}
