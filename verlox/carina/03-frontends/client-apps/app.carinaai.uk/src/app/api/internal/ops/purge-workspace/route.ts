import { NextResponse } from 'next/server';
import { purgeCloudWorkspaceById } from '@/lib/purge-cloud-workspace';

export const dynamic = 'force-dynamic';

function internalKeyOk(request: Request): boolean {
  const key = request.headers.get('x-internal-key')?.trim() ?? '';
  if (!key) return false;
  const candidates = [
    process.env.CARINA_INTERNAL_KEY?.trim(),
    process.env.CARINA_OPS_TOKEN?.trim(),
  ].filter(Boolean) as string[];
  return candidates.includes(key);
}

export async function POST(request: Request) {
  if (!internalKeyOk(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    workspaceId?: string;
    confirmId?: string;
  };
  const workspaceId = String(body.workspaceId ?? body.confirmId ?? '').trim();
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
  }
  if (body.confirmId && String(body.confirmId).trim() !== workspaceId) {
    return NextResponse.json({ error: 'confirmId must match workspaceId' }, { status: 400 });
  }

  try {
    const result = await purgeCloudWorkspaceById(workspaceId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cloud purge failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
