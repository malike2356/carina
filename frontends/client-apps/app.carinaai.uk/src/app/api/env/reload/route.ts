import { NextResponse } from 'next/server';
import {
  environmentCoreConfigured,
  reloadEnvironmentOnCore,
} from '@/lib/environment-core';
import { getSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!environmentCoreConfigured()) {
    return NextResponse.json(
      {
        error:
          'Core proxy is not configured. Set CARINA_USE_CORE_PROXY=true with CARINA_CORE_URL and CARINA_OPS_TOKEN.',
      },
      { status: 503 },
    );
  }

  try {
    const result = await reloadEnvironmentOnCore();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
