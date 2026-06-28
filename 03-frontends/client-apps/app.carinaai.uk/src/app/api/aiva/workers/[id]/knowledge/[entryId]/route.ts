import { NextRequest } from 'next/server';
import { handleAivaProxy } from '@/lib/aiva-route';

type RouteContext = { params: Promise<{ entryId: string; id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id, entryId } = await context.params;
  return handleAivaProxy(request, `/api/aiva/workers/${id}/knowledge/${entryId}`);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id, entryId } = await context.params;
  return handleAivaProxy(request, `/api/aiva/workers/${id}/knowledge/${entryId}`);
}
