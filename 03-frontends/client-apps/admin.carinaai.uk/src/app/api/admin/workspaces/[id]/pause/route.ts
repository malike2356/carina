import type { NextRequest } from 'next/server';
import { proxyAdminRequest } from '@/lib/proxy-admin';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return proxyAdminRequest(`/api/admin/workspaces/${id}/pause`, {
    method: 'POST',
    body: '{}',
  });
}
