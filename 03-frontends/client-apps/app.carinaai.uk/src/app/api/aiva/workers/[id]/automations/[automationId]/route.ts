import { NextRequest } from 'next/server';
import { handleAivaProxy } from '@/lib/aiva-route';

type RouteContext = { params: Promise<{ id: string; automationId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id, automationId } = await context.params;
  return handleAivaProxy(request, `/api/aiva/workers/${id}/automations/${automationId}`);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id, automationId } = await context.params;
  return handleAivaProxy(request, `/api/aiva/workers/${id}/automations/${automationId}`);
}
