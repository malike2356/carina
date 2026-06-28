import { NextResponse } from 'next/server';
import { CoreAdminError, coreAdminFetchRaw } from '@/lib/admin-api';

export async function GET() {
  try {
    const res = await coreAdminFetchRaw('/api/admin/scout/signals/stream');
    return new NextResponse(res.body, {
      status: res.status,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    if (err instanceof CoreAdminError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to open signal stream' }, { status: 500 });
  }
}
