import { NextRequest } from 'next/server';
import { handleAivaProxy } from '@/lib/aiva-route';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; runId: string }> },
) {
  const { id, runId } = await context.params;
  return handleAivaProxy(request, `/api/aiva/workers/${id}/automations/runs/${runId}/approve`);
}
