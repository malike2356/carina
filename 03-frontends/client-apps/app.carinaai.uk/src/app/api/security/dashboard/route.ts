import { NextResponse } from 'next/server';
import {
  buildDevSecurityDashboardStub,
  fetchSecurityDashboardFromCore,
  securityDashboardCoreConfigured,
} from '@/lib/security-dashboard-core';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (securityDashboardCoreConfigured()) {
      const data = await fetchSecurityDashboardFromCore();
      return NextResponse.json({ data, source: 'core' });
    }
    return NextResponse.json({
      data: buildDevSecurityDashboardStub(),
      source: 'stub',
      warning: 'Set CARINA_USE_CORE_PROXY=true with CARINA_CORE_URL and CARINA_INTERNAL_KEY for live data.',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
