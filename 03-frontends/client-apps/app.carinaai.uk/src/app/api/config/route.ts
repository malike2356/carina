import { NextResponse } from 'next/server';
import { requireWorkspace, getSession } from '@/lib/session';
import { getProductSurface } from '@/lib/product-surface';

export const dynamic = 'force-dynamic';

/**
 * Mobile companion contract: GET /api/config
 * Thin shim so cloud mode never returns Next.js HTML 404.
 */
export async function GET() {
  const session = await getSession();
  const workspace = session ? await requireWorkspace(session.user.id) : null;
  const hostname = process.env.NEXT_PUBLIC_APP_HOST ?? process.env.APP_HOST ?? '';
  return NextResponse.json({
    hosted: true,
    authenticated: Boolean(session?.user),
    product: 'carina-cloud',
    surface: getProductSurface(hostname || 'app.carinaai.uk'),
    hostname: hostname || 'app.carinaai.uk',
    workspace: workspace
      ? {
          id: workspace.id,
          plan: workspace.plan,
          name: workspace.name,
        }
      : null,
    features: {
      chat: true,
      memory: true,
      packs: true,
      billing: true,
      scout: true,
    },
  });
}
