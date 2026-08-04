import { NextRequest } from 'next/server';
import { handleConversationsProxy } from '@/lib/conversations-proxy';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return handleConversationsProxy(request, `/api/conversations/${id}/export-pdf`);
}
