import { NextRequest, NextResponse } from 'next/server';
import { CoreAdminError, coreAdminFetchRaw } from '@/lib/admin-api';

export async function GET(request: NextRequest) {
  try {
    const incoming = new URL(request.url);
    const res = await coreAdminFetchRaw(`/api/admin/scout/signals${incoming.search}`);
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof CoreAdminError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to load signals' }, { status: 500 });
  }
}
