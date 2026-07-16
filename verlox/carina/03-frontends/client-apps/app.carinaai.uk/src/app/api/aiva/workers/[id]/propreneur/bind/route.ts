import { NextRequest } from 'next/server';
import { handleAivaProxy } from '@/lib/aiva-route';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return handleAivaProxy(request, `/api/aiva/workers/${id}/propreneur/bind`);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return handleAivaProxy(request, `/api/aiva/workers/${id}/propreneur/bind`);
}
