import { NextRequest } from 'next/server';
import { handleAivaProxy } from '@/lib/aiva-route';

type RouteContext = { params: Promise<{ leadId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { leadId } = await context.params;
  return handleAivaProxy(request, `/api/aiva/youtube-channel/leads/${encodeURIComponent(leadId)}`);
}
