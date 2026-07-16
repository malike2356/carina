import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Mobile companion contract: GET /app/auth/push/status
 */
export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  return NextResponse.json({
    registered: false,
    tokenCount: 0,
    taskAlerts: false,
    scoutAlerts: false,
  });
}
