import { NextRequest } from 'next/server';
import { handleAivaProxy } from '@/lib/aiva-route';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; automationId: string }> },
) {
  const { id, automationId } = await context.params;
  return handleAivaProxy(request, `/api/aiva/workers/${id}/automations/${automationId}/runs`);
}
