import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { queryContactActivity } from '@/lib/contact-activity';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const url = new URL(request.url);
  const email = url.searchParams.get('email');
  const name = url.searchParams.get('name');
  const phone = url.searchParams.get('phone');
  const limitRaw = Number(url.searchParams.get('limit') ?? 40);

  if (!email?.trim() && !name?.trim() && !phone?.trim()) {
    return NextResponse.json({
      data: {
        items: [],
        counts: { email: 0, meeting: 0, total: 0 },
        match: { email: null, name: null, phone: null },
      },
    });
  }

  const data = await queryContactActivity({
    workspaceId: workspace.id,
    email,
    name,
    phone,
    limit: Number.isFinite(limitRaw) ? limitRaw : 40,
  });

  return NextResponse.json({ data });
}
