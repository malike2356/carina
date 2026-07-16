import type { NextRequest } from 'next/server';
import { proxyAdminRequest } from '@/lib/proxy-admin';

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search;
  return proxyAdminRequest(`/api/admin/attestation/unattested${search}`);
}
