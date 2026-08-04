import { NextRequest } from 'next/server';
import { handleAivaProxy } from '@/lib/aiva-route';

export async function GET(request: NextRequest) {
  const qs = request.nextUrl.search;
  return handleAivaProxy(request, `/api/aiva/conversations/search${qs}`);
}
