import { NextRequest, NextResponse } from 'next/server';
import { CoreAdminError, coreAdminFetchRaw } from '@/lib/admin-api';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  try {
    const res = await coreAdminFetchRaw(`/api/admin/fleet/${id}`);
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof CoreAdminError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to load fleet detail' }, { status: 500 });
  }
}
