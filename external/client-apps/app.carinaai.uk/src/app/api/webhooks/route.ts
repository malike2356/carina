import { proxyToCoreApi } from '@/lib/core-api-proxy';
import { getSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureAuthed(): Promise<boolean> {
  const session = await getSession();
  return Boolean(session);
}

export async function GET(request: Request): Promise<Response> {
  if (!(await ensureAuthed())) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return proxyToCoreApi(request, '/api/webhooks');
}

export async function POST(request: Request): Promise<Response> {
  if (!(await ensureAuthed())) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return proxyToCoreApi(request, '/api/webhooks');
}
