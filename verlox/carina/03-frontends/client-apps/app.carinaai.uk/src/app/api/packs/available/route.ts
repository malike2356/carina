import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { workspaceSettings } from '@/db/schema';
import { buildWorkspacePackStorefront } from '@/lib/pack-storefront';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Mobile companion contract: GET /api/packs/available
 */
export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  try {
    const workspace = await requireWorkspace(session.user.id);
    const [settings] = await db
      .select({ packCatalog: workspaceSettings.packCatalog })
      .from(workspaceSettings)
      .where(eq(workspaceSettings.workspaceId, workspace.id))
      .limit(1);
    const storefront = buildWorkspacePackStorefront({
      workspaceId: workspace.id,
      activeSkillPacks: workspace.activeSkillPacks,
      packCatalog: settings?.packCatalog ?? [],
    });

    return NextResponse.json({
      packs: storefront.packs
        .filter((pack) => pack.slug !== 'property-uk')
        .map((pack) => ({
          name: pack.slug,
          version: pack.version,
          description: pack.description,
          author: 'Carina',
          skill_count: 0,
          download_count: 0,
        })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load packs';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
