import type { NextRequest } from 'next/server';
import { proxyAdminRequest } from '@/lib/proxy-admin';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.text();
  return proxyAdminRequest(`/api/admin/workspaces/${id}/credit`, {
    method: 'POST',
    body: body || '{}',
  });
}
