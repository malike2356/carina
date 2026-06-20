import { NextResponse } from 'next/server';
import { listPairingDevices } from '@/lib/pairing';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await requireWorkspace(session.user.id);

  try {
    const data = await listPairingDevices();
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Device list unavailable';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
