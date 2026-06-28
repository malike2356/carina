import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { getAdminSession } from '@/lib/admin-session';

export async function GET() {
  const session = await getAdminSession();
  if (!session.pendingTotp || session.pendingTotp !== 'totp_setup' || !session.pendingOtpauthUrl) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const qrDataUrl = await QRCode.toDataURL(session.pendingOtpauthUrl, { margin: 1, width: 220 });
  return NextResponse.json({ qrDataUrl, email: session.email });
}
