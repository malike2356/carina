import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import {
  cyberToolsCoreConfigured,
  fetchCyberToolsFromCore,
  buildCyberToolsStub,
} from '@/lib/cyber-tools-core';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (cyberToolsCoreConfigured()) {
    try {
      const data = await fetchCyberToolsFromCore();
      return NextResponse.json({ ...data, source: 'core' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const tools = buildCyberToolsStub();
      return NextResponse.json({
        tools,
        total: tools.length,
        source: 'stub',
        warning: `Core cyber tools unavailable (${message}). Showing cached registry.`,
      });
    }
  }

  const tools = buildCyberToolsStub();
  return NextResponse.json({
    tools,
    total: tools.length,
    source: 'stub',
    warning: 'Set CARINA_USE_CORE_PROXY=true with CARINA_CORE_URL for live data.',
  });
}
