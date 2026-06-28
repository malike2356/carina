import type { NextRequest } from 'next/server';
import { proxyAdminRequest } from '@/lib/proxy-admin';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string; keyId: string }> };

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id, keyId } = await context.params;
  return proxyAdminRequest(`/api/carina-ops/internal/partners/${id}/keys/${keyId}`, {
    method: 'DELETE',
  });
}
