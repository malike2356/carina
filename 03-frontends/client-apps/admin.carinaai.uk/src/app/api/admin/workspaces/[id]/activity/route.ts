import type { NextRequest } from 'next/server';
import { proxyAdminRequest } from '@/lib/proxy-admin';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const search = request.nextUrl.search;
  return proxyAdminRequest(`/api/admin/workspaces/${id}/activity${search}`);
}
