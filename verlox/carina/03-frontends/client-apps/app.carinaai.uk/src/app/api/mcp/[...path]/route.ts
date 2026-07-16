import { getSession } from '@/lib/session';
import { proxyToCoreApi } from '@/lib/core-api-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureAuthed(): Promise<boolean> {
  const session = await getSession();
  return Boolean(session);
}

function buildPath(path: string[]): string {
  return `/api/mcp/${path.map(encodeURIComponent).join('/')}`;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  if (!(await ensureAuthed())) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { path } = await context.params;
  return proxyToCoreApi(request, buildPath(path));
}

export async function POST(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  if (!(await ensureAuthed())) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { path } = await context.params;
  return proxyToCoreApi(request, buildPath(path));
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  if (!(await ensureAuthed())) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { path } = await context.params;
  return proxyToCoreApi(request, buildPath(path));
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  if (!(await ensureAuthed())) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { path } = await context.params;
  return proxyToCoreApi(request, buildPath(path));
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  if (!(await ensureAuthed())) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { path } = await context.params;
  return proxyToCoreApi(request, buildPath(path));
}
