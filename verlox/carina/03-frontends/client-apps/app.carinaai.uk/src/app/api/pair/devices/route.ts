import { NextResponse } from 'next/server';
import { listPairingDevices } from '@/lib/pairing';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Mobile companion contract: GET /api/pair/devices
 * Accepts Cloud session (Bearer) or returns empty when core proxy is unavailable.
 */
export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  try {
    await requireWorkspace(session.user.id);
    const devices = await listPairingDevices();
    return NextResponse.json({
      devices: devices.map((device) => ({
        id: device.id,
        name: device.name,
        platform: device.platform,
        pairedAt: device.pairedAt,
        lastSeen: device.lastSeen ?? device.lastSeenAt ?? new Date().toISOString(),
        scopes: device.scopes ?? [],
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Device list unavailable';
    // Soft-fail for mobile: unpaired / core-down should not dump HTML.
    if (/not configured|502|lookup failed/i.test(message)) {
      return NextResponse.json({ devices: [] });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
