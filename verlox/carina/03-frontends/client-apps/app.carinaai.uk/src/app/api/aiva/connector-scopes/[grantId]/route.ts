import { NextRequest } from 'next/server';
import { handleAivaProxy } from '@/lib/aiva-route';

type RouteContext = { params: Promise<{ grantId: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { grantId } = await context.params;
  return handleAivaProxy(request, `/api/aiva/connector-scopes/${grantId}`);
}
