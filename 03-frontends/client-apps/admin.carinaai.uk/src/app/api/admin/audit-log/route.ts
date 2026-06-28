import { NextRequest, NextResponse } from 'next/server';
import { CoreAdminError, coreAdminFetchRaw } from '@/lib/admin-api';

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.search;
    const res = await coreAdminFetchRaw(`/api/admin/audit-log${search}`);
    const contentType = res.headers.get('content-type') ?? 'application/json';
    const disposition = res.headers.get('content-disposition');
    const body = await res.text();
    const headers: Record<string, string> = { 'Content-Type': contentType };
    if (disposition) headers['Content-Disposition'] = disposition;
    return new NextResponse(body, { status: res.status, headers });
  } catch (err) {
    if (err instanceof CoreAdminError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to load audit log' }, { status: 500 });
  }
}
