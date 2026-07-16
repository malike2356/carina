import { NextResponse } from 'next/server';
import { revokePairingDevice } from '@/lib/pairing';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Mobile companion contract: DELETE /api/pair/devices/:id
 */
export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  await requireWorkspace(session.user.id);
  const { id } = await context.params;

  try {
    await revokePairingDevice(id);
    return NextResponse.json({ revoked: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to revoke device';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
