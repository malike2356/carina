import { NextResponse } from 'next/server';
import { CoreAdminError, coreAdminFetchRaw } from '@/lib/admin-api';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const res = await coreAdminFetchRaw(`/api/admin/va/queue/${id}/first-response`, { method: 'PATCH' });
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof CoreAdminError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to mark first response' }, { status: 500 });
  }
}
