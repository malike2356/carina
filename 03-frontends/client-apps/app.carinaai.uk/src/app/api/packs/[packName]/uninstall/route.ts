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
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ packName: string }> };

/**
 * Mobile companion contract: POST /api/packs/:packName/uninstall
 */
export async function POST(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  try {
    const workspace = await requireWorkspace(session.user.id);
    const { packName: raw } = await context.params;
    const packName = decodeURIComponent(raw).trim();
    if (!packName) {
      return NextResponse.json({ error: 'packName is required' }, { status: 400 });
    }

    const current = parseActiveSkillPacks(workspace.activeSkillPacks);
    const next = togglePack(current, packName, false);
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
      action: 'packs.disabled',
      detail: { slug: packName, activePacks: next, source: 'mobile' },
    });

    return NextResponse.json({ uninstalled: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to uninstall pack';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
