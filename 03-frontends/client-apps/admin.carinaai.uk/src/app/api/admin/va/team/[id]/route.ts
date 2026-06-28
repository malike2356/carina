import type { NextRequest } from 'next/server';
import { proxyAdminRequest } from '@/lib/proxy-admin';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.text();
  return proxyAdminRequest(`/api/admin/va/team/${id}`, {
    method: 'PATCH',
    body,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return proxyAdminRequest(`/api/admin/va/team/${id}`, { method: 'DELETE' });
}
