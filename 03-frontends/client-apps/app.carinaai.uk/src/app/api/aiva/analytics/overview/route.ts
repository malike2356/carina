import { NextRequest } from 'next/server';
import { handleConversationsProxy } from '@/lib/conversations-proxy';

export async function GET(request: NextRequest) {
  return handleConversationsProxy(request, '/api/aiva/analytics/overview');
}
