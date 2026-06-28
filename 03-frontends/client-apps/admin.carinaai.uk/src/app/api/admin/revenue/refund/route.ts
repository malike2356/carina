import { NextRequest, NextResponse } from 'next/server';
import { CoreAdminError, coreAdminFetchRaw } from '@/lib/admin-api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const res = await coreAdminFetchRaw('/api/admin/revenue/refund', {
      method: 'POST',
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
    return NextResponse.json({ error: 'Failed to process refund' }, { status: 500 });
  }
}
