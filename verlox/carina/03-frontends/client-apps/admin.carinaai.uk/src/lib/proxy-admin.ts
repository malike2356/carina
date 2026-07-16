import { NextResponse } from 'next/server';
import { CoreAdminError, coreAdminFetchRaw } from '@/lib/admin-api';

export async function proxyAdminRequest(path: string, init?: RequestInit): Promise<NextResponse> {
  try {
    const res = await coreAdminFetchRaw(path, init);
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof CoreAdminError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}
