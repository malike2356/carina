import { getSession } from '@/lib/session';
import { proxyToCoreApi } from '@/lib/core-api-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return proxyToCoreApi(request, '/api/ops/logs');
}
