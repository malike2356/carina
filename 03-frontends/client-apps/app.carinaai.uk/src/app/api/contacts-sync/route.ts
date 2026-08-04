import { NextRequest } from 'next/server';
import { handleAivaProxy } from '@/lib/aiva-route';

export async function GET(request: NextRequest) {
  return handleAivaProxy(request, '/api/contacts-sync/status');
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action') ?? 'csv';
  return handleAivaProxy(request, `/api/contacts-sync/${action}`);
}
