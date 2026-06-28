import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import {
  cyberToolsCoreConfigured,
  fetchCyberToolHealthFromCore,
} from '@/lib/cyber-tools-core';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!cyberToolsCoreConfigured()) {
    return NextResponse.json({
      health: [],
      installedCount: 0,
      total: 0,
      source: 'stub',
      warning: 'Core proxy not configured. Health check unavailable.',
    });
  }

  try {
    const data = await fetchCyberToolHealthFromCore();
    return NextResponse.json({ ...data, source: 'core' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      health: [],
      installedCount: 0,
      total: 0,
      source: 'stub',
      warning: `Core health check unavailable (${message}).`,
    });
  }
}
