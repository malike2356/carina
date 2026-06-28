import { NextRequest } from 'next/server';
import { handleAivaProxy } from '@/lib/aiva-route';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return handleAivaProxy(request, `/api/conversations/${id}/export`);
}
