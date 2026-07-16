import { NextRequest, NextResponse } from 'next/server';
import { handleAivaProxy, AIVA_ACTIVE_ORG_COOKIE } from '@/lib/aiva-route';

type RouteContext = { params: Promise<{ path?: string[] }> };

function orgsPath(parts: string[] | undefined): string {
  const suffix = (parts ?? []).map((part) => encodeURIComponent(part)).join('/');
  return suffix ? `/api/aiva/orgs/${suffix}` : '/api/aiva/orgs';
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return handleAivaProxy(request, orgsPath(path));
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const parts = path ?? [];
  const isActive = parts.length === 1 && parts[0] === 'active';
  const response = await handleAivaProxy(request, orgsPath(parts));
  if (!isActive || response.status >= 400) return response;

  const text = await response.text();
  let orgId = '';
  try {
    const data = JSON.parse(text) as {
      activeOrgId?: string | null;
      orgs?: Array<{ id: string; active?: boolean }>;
    };
    orgId = data.activeOrgId ?? data.orgs?.find((org) => org.active)?.id ?? '';
  } catch {
    orgId = '';
  }

  const next = new NextResponse(text, {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  });
  if (orgId) {
    next.cookies.set(AIVA_ACTIVE_ORG_COOKIE, orgId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return next;
}
