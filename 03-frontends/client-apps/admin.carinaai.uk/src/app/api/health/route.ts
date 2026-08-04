import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function resolveCoreUrl(): string {
  return (process.env.ADMIN_CORE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

export async function GET() {
  const checks: Record<string, string> = {};
  let healthy = true;

  try {
    const res = await fetch(new URL('/health', resolveCoreUrl()).toString(), {
      signal: AbortSignal.timeout(5000),
    });
    const body = await res.json().catch(() => ({}));
    checks.core_api = res.ok ? 'ok' : 'degraded';
    if (!res.ok) healthy = false;
    if (body && typeof body === 'object' && 'checks' in body) {
      const coreChecks = (body as { checks?: Record<string, string> }).checks;
      if (coreChecks?.database) checks.core_database = coreChecks.database;
      if (coreChecks?.backup) checks.core_backup = coreChecks.backup;
    }
  } catch {
    checks.core_api = 'fail';
    healthy = false;
  }

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      service: 'carina-admin',
      revision: process.env.BUILD_REVISION ?? 'unknown',
      imageDigest: process.env.IMAGE_DIGEST ?? 'unknown',
      buildTime: process.env.BUILD_TIME ?? 'unknown',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: healthy ? 200 : 503 },
  );
}
