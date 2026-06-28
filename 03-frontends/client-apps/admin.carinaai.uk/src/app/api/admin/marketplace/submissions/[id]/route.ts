import type { NextRequest } from 'next/server';
import { proxyAdminRequest } from '@/lib/proxy-admin';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return proxyAdminRequest(`/api/carina-ops/internal/marketplace/submissions/${id}`);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.text();
  return proxyAdminRequest(`/api/carina-ops/internal/marketplace/submissions/${id}`, {
    method: 'PATCH',
    body,
    headers: { 'content-type': 'application/json' },
  });
}
