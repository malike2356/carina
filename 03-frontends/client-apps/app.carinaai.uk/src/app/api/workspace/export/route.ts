import { NextResponse } from 'next/server';
import { requireSession, requireWorkspace } from '@/lib/session';
import { proxyAivaRequest } from '@/lib/aiva-proxy';

export async function POST() {
  try {
    const session = await requireSession();
    const workspace = await requireWorkspace(session.user.id);
    const upstream = await proxyAivaRequest(workspace.id, '/api/aiva/workspace/export', {
      method: 'POST',
    });
    const buffer = await upstream.arrayBuffer();
    return new NextResponse(buffer, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'application/zip',
        'Content-Disposition':
          upstream.headers.get('content-disposition') ?? 'attachment; filename="carina-export.zip"',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
