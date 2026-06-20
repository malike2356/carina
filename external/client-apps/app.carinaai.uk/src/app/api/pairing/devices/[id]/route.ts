import { NextResponse } from 'next/server';
import { revokePairingDevice } from '@/lib/pairing';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await requireWorkspace(session.user.id);

  const { id } = await params;
  try {
    await revokePairingDevice(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to revoke device';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
