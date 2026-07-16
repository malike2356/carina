import { NextResponse } from 'next/server';
import { resolveCoreUrl } from '@/lib/core-proxy';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, string> = {};
  let healthy = true;

  try {
    const coreUrl = resolveCoreUrl();
    const res = await fetch(new URL('/health', coreUrl).toString(), {
      signal: AbortSignal.timeout(5000),
    });
    const body = await res.json().catch(() => ({}));
    checks.core_api = res.ok ? 'ok' : 'degraded';
    if (!res.ok) healthy = false;
    if (body && typeof body === 'object' && 'checks' in body) {
      checks.core_database = (body as { checks?: { database?: string } }).checks?.database ?? 'unknown';
    }
  } catch {
    checks.core_api = 'fail';
    healthy = false;
  }

  return NextResponse.json(
    {
      ok: healthy,
      status: healthy ? 'ok' : 'degraded',
      service: 'carina-cloud',
      revision: process.env.BUILD_REVISION ?? 'unknown',
      imageDigest: process.env.IMAGE_DIGEST ?? 'unknown',
      buildTime: process.env.BUILD_TIME ?? 'unknown',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: healthy ? 200 : 503 },
  );
}
