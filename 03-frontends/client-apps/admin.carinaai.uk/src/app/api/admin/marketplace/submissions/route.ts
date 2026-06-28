import type { NextRequest } from 'next/server';
import { proxyAdminRequest } from '@/lib/proxy-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.toString();
  const path = search ? `/api/carina-ops/internal/marketplace/submissions?${search}` : '/api/carina-ops/internal/marketplace/submissions';
  return proxyAdminRequest(path);
}
