import { proxyToCoreApi } from '@/lib/core-api-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return proxyToCoreApi(request, '/api/incident-blog/subscribe');
}

export async function GET(request: Request): Promise<Response> {
  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}
