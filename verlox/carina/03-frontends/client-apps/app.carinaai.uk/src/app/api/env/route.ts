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
        'Live environment data needs CARINA_OPS_TOKEN on the cloud app (same value as core). Run docker/scripts/fix-cloud-terminal.sh on the VPS, then redeploy carina-cloud.',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
