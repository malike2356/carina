import { NextResponse } from 'next/server';
import { proxyToCoreApi } from '@/lib/core-api-proxy';

export async function GET(request: Request) {
  try {
    return await proxyToCoreApi(request, '/api/aiva/propreneur/session-tenant');
  } catch {
    return NextResponse.json({ error: 'Session tenant proxy failed' }, { status: 502 });
  }
}

export async function POST(request: Request) {
  try {
    return await proxyToCoreApi(request, '/api/aiva/propreneur/session-tenant');
  } catch {
    return NextResponse.json({ error: 'Session tenant proxy failed' }, { status: 502 });
  }
}
