import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { workspaces } from '@/db/schema';
import { writeAuditLog } from '@/lib/audit';
import {
  PLATFORM_PACKS,
  parseActiveSkillPacks,
  serializeActiveSkillPacks,
  togglePack,
} from '@/lib/pack-storefront';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ packName: string }> };

/**
 * Mobile companion contract: POST /api/packs/:packName/install
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
    if (!packName || packName === 'property-uk') {
      return NextResponse.json({ error: 'Pack not available on mobile' }, { status: 400 });
    }
    if (!PLATFORM_PACKS[packName]) {
      return NextResponse.json({ error: 'Unknown pack' }, { status: 404 });
    }

    const current = parseActiveSkillPacks(workspace.activeSkillPacks);
    const next = togglePack(current, packName, true);
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
      action: 'packs.enabled',
      detail: { slug: packName, activePacks: next, source: 'mobile' },
    });

    return NextResponse.json({
      installed: true,
      pack: packName,
      version: PLATFORM_PACKS[packName].version,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to install pack';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
