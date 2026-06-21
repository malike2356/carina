import { NextResponse } from 'next/server';
import { getPendingPairing } from '@/lib/pairing';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await requireWorkspace(session.user.id);

  try {
    const data = await getPendingPairing();
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Pairing status unavailable';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
