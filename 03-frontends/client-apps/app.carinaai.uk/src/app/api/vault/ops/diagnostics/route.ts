import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { buildVaultDiagnostics } from '@/lib/document-vault/pg-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);
  const data = await buildVaultDiagnostics(workspace.id);
  return NextResponse.json({ data });
}
