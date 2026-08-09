import { NextResponse } from 'next/server';
import { proxyToCoreApi } from '@/lib/core-api-proxy';

export async function GET(request: Request) {
  try {
    return await proxyToCoreApi(request, '/api/aiva/propreneur/sync-health');
  } catch {
    return NextResponse.json({ error: 'Sync health proxy failed' }, { status: 502 });
  }
}
