import { NextResponse } from 'next/server';
import { CoreAdminError, coreAdminFetchRaw } from '@/lib/admin-api';

export async function GET() {
  try {
    const res = await coreAdminFetchRaw('/api/admin/va/team');
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof CoreAdminError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to load VA team' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const res = await coreAdminFetchRaw('/api/admin/va/team', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
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
    return NextResponse.json({ error: 'Failed to add team member' }, { status: 500 });
  }
}
