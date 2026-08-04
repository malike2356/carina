import { NextRequest } from 'next/server';
import { handleAivaProxy } from '@/lib/aiva-route';

export async function GET(request: NextRequest) {
  const qs = request.nextUrl.search;
  return handleAivaProxy(request, `/api/aiva/connector-scopes${qs}`);
}

export async function POST(request: NextRequest) {
  return handleAivaProxy(request, '/api/aiva/connector-scopes');
}
