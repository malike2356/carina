import { NextRequest } from 'next/server';
import { handleAivaProxy } from '@/lib/aiva-route';

/** Auto-resync schedule for Google Contacts (default on when Google is connected). */
export async function GET(request: NextRequest) {
  return handleAivaProxy(request, '/api/contacts-sync/schedule');
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  if (url.searchParams.get('run') === '1') {
    return handleAivaProxy(request, '/api/contacts-sync/schedule/run');
  }
  return handleAivaProxy(request, '/api/contacts-sync/schedule');
}
