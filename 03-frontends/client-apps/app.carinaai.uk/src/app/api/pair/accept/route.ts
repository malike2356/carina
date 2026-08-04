import { NextResponse } from 'next/server';
import { acceptPairingToken } from '@/lib/pairing';

export const dynamic = 'force-dynamic';

/**
 * Public claim endpoint for Carina Mobile (POST /api/pair/accept).
 * Proxies to core; no Cloud session cookie required (device presents the pairing token).
 */
export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const token = String(body.token ?? '').trim();
  if (!token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 });
  }

  try {
    const data = await acceptPairingToken({
      token,
      deviceName: String(body.deviceName ?? body.name ?? 'Paired device'),
      deviceId: body.deviceId ? String(body.deviceId) : undefined,
      platform: body.platform ? String(body.platform) : undefined,
    });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Pairing failed';
    const status = /expired|invalid/i.test(message) ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
