import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { workspaces } from '@/db/schema';
import { writeAuditLog } from '@/lib/audit';
import {
  mergeTemplatePacks,
  parseActiveSkillPacks,
  serializeActiveSkillPacks,
} from '@/lib/pack-storefront';
import { requireSession, requireWorkspace } from '@/lib/session';

export async function POST(
  _request: Request,
  context: { params: Promise<{ templateId: string }> },
) {
  try {
    const session = await requireSession();
    const workspace = await requireWorkspace(session.user.id);
    const { templateId } = await context.params;
    const current = parseActiveSkillPacks(workspace.activeSkillPacks);
    const next = mergeTemplatePacks(current, templateId);
    if (next.length === current.length) {
      return NextResponse.json({ error: 'Unknown template' }, { status: 400 });
    }
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
      action: 'packs.template_installed',
      detail: { templateId, packs: next },
    });
    return NextResponse.json({ data: { activePacks: next } });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
