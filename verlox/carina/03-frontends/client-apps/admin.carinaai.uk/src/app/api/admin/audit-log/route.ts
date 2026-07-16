import { NextRequest, NextResponse } from 'next/server';
import { CoreAdminError, coreAdminFetchRaw } from '@/lib/admin-api';

function isCoreAdminError(err: unknown): err is CoreAdminError {
  return (
    err instanceof CoreAdminError
    || (typeof err === 'object'
      && err !== null
      && 'name' in err
      && (err as { name?: string }).name === 'CoreAdminError'
      && 'status' in err)
  );
}

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.search;
    const res = await coreAdminFetchRaw(`/api/admin/audit-log${search}`);
    const contentType = res.headers.get('content-type') ?? 'application/json';
    const disposition = res.headers.get('content-disposition');
    const body = await res.text();
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
    };
    if (disposition) headers['Content-Disposition'] = disposition;
    return new NextResponse(body, { status: res.status, headers });
  } catch (err) {
    if (isCoreAdminError(err)) {
      return NextResponse.json(
        { error: err.message || 'Unauthorized' },
        { status: typeof err.status === 'number' ? err.status : 401 },
      );
    }
    const message = err instanceof Error ? err.message : 'Failed to load audit log';
    console.error('[admin] audit-log proxy failed:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
