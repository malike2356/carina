import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { workspaceSettings, workspaces } from '@/db/schema';
import { normalizeBrandConfig, resolveWorkspaceBrand } from '@/lib/brand';
import { buildWorkspacePackStorefront } from '@/lib/pack-storefront';
import { requireSession, requireWorkspace } from '@/lib/session';

export async function GET() {
  try {
    const session = await requireSession();
    const workspace = await requireWorkspace(session.user.id);
    const [settings] = await db
      .select({
        brand: workspaceSettings.brand,
        packCatalog: workspaceSettings.packCatalog,
      })
      .from(workspaceSettings)
      .where(eq(workspaceSettings.workspaceId, workspace.id))
      .limit(1);
    const resolvedBrand = resolveWorkspaceBrand({
      workspaceBrand: normalizeBrandConfig(settings?.brand ?? {}),
    });
    const storefront = buildWorkspacePackStorefront({
      workspaceId: workspace.id,
      activeSkillPacks: workspace.activeSkillPacks,
      productName: resolvedBrand.productName,
      packCatalog: settings?.packCatalog ?? [],
    });
    return NextResponse.json({ data: storefront });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
