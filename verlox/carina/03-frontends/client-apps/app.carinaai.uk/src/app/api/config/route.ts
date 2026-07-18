import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Mobile companion contract: GET /api/config
 * Thin shim so cloud mode never returns Next.js HTML 404.
 */
export async function GET() {
  const session = await getSession();
  return NextResponse.json({
    hosted: true,
    authenticated: Boolean(session?.user),
    product: 'carina-cloud',
    features: {
      chat: true,
      memory: true,
      packs: true,
      billing: true,
      scout: true,
    },
  });
}
