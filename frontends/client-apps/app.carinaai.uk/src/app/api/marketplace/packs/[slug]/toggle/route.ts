import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { workspaces } from '@/db/schema';
import { writeAuditLog } from '@/lib/audit';
import {
  parseActiveSkillPacks,
  serializeActiveSkillPacks,
  togglePack,
} from '@/lib/pack-storefront';
import { requireSession, requireWorkspace } from '@/lib/session';

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const session = await requireSession();
    const workspace = await requireWorkspace(session.user.id);
    const { slug } = await context.params;
    const body = await request.json().catch(() => ({}));
    const enabled = body?.enabled !== false;
    const current = parseActiveSkillPacks(workspace.activeSkillPacks);
    const next = togglePack(current, decodeURIComponent(slug), enabled);
    await db
      .update(workspaces)
      .set({
        activeSkillPacks: serializeActiveSkillPacks(next),
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, workspace.id));
    await writeAuditLog({
      workspaceId: workspace.id,
      userId: session.user.id,
      action: enabled ? 'packs.enabled' : 'packs.disabled',
      detail: { slug, activePacks: next },
    });
    return NextResponse.json({ data: { activePacks: next } });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
