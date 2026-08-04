import type { NextRequest } from 'next/server';
import { proxyAdminRequest } from '@/lib/proxy-admin';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.text();
  return proxyAdminRequest(`/api/admin/workspaces/${id}/plan`, {
    method: 'PATCH',
    body: body || '{}',
  });
}
