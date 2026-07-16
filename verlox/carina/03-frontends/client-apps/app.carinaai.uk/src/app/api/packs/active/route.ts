import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { workspaceSettings } from '@/db/schema';
import {
  buildWorkspacePackStorefront,
  parseActiveSkillPacks,
} from '@/lib/pack-storefront';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Mobile companion contract: GET /api/packs/active
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
    const active = parseActiveSkillPacks(workspace.activeSkillPacks).filter(
      (slug) => slug !== 'property-uk',
    );

    return NextResponse.json({
      active,
      installed: storefront.packs
        .filter((pack) => pack.installed && pack.slug !== 'property-uk')
        .map((pack) => ({
          pack_name: pack.slug,
          version: pack.version,
          installed_at: new Date().toISOString(),
          status: 'active',
        })),
      management: 'cloud',
      source: 'workspace',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load active packs';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
