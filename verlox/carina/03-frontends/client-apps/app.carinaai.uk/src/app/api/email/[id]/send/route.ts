import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, _context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json(
    {
      error:
        'Use the Email Handler approval inbox at /aiva/approvals to approve and send drafts.',
      approvalInboxPath: '/aiva/approvals',
    },
    { status: 410 },
  );
}
