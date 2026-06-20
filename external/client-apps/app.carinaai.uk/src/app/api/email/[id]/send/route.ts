import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, _context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json(
    { error: 'Outbound email is not available on Carina Cloud yet. Save drafts for review only.' },
    { status: 501 },
  );
}
