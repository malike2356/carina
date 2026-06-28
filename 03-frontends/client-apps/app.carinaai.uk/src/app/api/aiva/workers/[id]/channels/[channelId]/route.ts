import { NextRequest } from 'next/server';
import { handleAivaProxy } from '@/lib/aiva-route';

type RouteContext = { params: Promise<{ id: string; channelId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id, channelId } = await context.params;
  return handleAivaProxy(request, `/api/aiva/workers/${id}/channels/${channelId}`);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id, channelId } = await context.params;
  return handleAivaProxy(request, `/api/aiva/workers/${id}/channels/${channelId}`);
}
