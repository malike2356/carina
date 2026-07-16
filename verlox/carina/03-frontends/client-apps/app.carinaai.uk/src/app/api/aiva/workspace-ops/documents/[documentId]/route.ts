import { NextRequest } from 'next/server';
import { handleAivaProxy } from '@/lib/aiva-route';

type RouteContext = { params: Promise<{ documentId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { documentId } = await context.params;
  return handleAivaProxy(request, `/api/aiva/workspace-ops/documents/${documentId}`);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { documentId } = await context.params;
  return handleAivaProxy(request, `/api/aiva/workspace-ops/documents/${documentId}`);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { documentId } = await context.params;
  return handleAivaProxy(request, `/api/aiva/workspace-ops/documents/${documentId}`);
}
