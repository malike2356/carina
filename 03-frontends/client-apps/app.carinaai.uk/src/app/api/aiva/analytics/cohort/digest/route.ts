import { NextRequest } from 'next/server';
import { handleConversationsProxy } from '@/lib/conversations-proxy';

export async function POST(request: NextRequest) {
  return handleConversationsProxy(request, '/api/aiva/analytics/cohort/digest');
}
