import { NextRequest } from 'next/server';
import { handleAivaProxy } from '@/lib/aiva-route';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const safeId = encodeURIComponent(String(id ?? '').trim());
  return handleAivaProxy(request, `/api/contacts-sync/${safeId}`);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const safeId = encodeURIComponent(String(id ?? '').trim());
  return handleAivaProxy(request, `/api/contacts-sync/${safeId}`);
}
