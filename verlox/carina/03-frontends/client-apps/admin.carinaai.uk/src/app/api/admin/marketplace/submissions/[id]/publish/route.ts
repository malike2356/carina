import type { NextRequest } from 'next/server';
import { proxyAdminRequest } from '@/lib/proxy-admin';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return proxyAdminRequest(`/api/carina-ops/internal/marketplace/submissions/${id}/publish`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
  });
}
