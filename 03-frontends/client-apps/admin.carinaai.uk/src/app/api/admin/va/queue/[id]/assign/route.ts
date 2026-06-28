import { NextRequest, NextResponse } from 'next/server';
import { CoreAdminError, coreAdminFetchRaw } from '@/lib/admin-api';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  try {
    const body = await request.text();
    const res = await coreAdminFetchRaw(`/api/admin/va/queue/${id}/assign`, {
      method: 'PATCH',
      body,
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof CoreAdminError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to assign escalation' }, { status: 500 });
  }
}
