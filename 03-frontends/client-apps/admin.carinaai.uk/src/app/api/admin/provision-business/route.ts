import type { NextRequest } from 'next/server';
import { proxyAdminRequest } from '@/lib/proxy-admin';

export async function POST(request: NextRequest) {
  const body = await request.text();
  return proxyAdminRequest('/api/admin/provision-business', {
    method: 'POST',
    body: body || '{}',
  });
}
