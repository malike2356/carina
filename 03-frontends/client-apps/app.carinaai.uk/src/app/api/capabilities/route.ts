import { NextResponse } from 'next/server';
import { getCloudCapabilities } from '@/lib/cloud-capabilities';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ data: getCloudCapabilities() });
}
