import { NextResponse } from 'next/server';
import {
  buildDevEnvironmentStub,
  environmentCoreConfigured,
  fetchEnvironmentFromCore,
} from '@/lib/environment-core';
import { getSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (environmentCoreConfigured()) {
      const environment = await fetchEnvironmentFromCore();
      return NextResponse.json({ environment, source: 'core' });
    }
    return NextResponse.json({
      environment: buildDevEnvironmentStub(),
      source: 'stub',
      warning:
        'Live environment data requires CARINA_USE_CORE_PROXY=true with CARINA_CORE_URL and a matching CARINA_OPS_TOKEN on core.',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
