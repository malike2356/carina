import { NextResponse } from 'next/server';
import { getDriveConnectionPublic } from '@/lib/document-vault/google/connection';

export const dynamic = 'force-dynamic';

function authorized(request: Request): boolean {
  const key = request.headers.get('x-internal-key')?.trim();
  return Boolean(process.env.CARINA_INTERNAL_KEY && key === process.env.CARINA_INTERNAL_KEY);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const workspaceId = new URL(request.url).searchParams.get('workspaceId')?.trim() ?? '';
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
  }
  const connection = await getDriveConnectionPublic(workspaceId);
  return NextResponse.json({ data: { connection } });
}
