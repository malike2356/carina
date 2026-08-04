import { NextRequest, NextResponse } from 'next/server';
import { handleAivaProxy } from '@/lib/aiva-route';

type RouteContext = { params: Promise<{ id: string; rest: string[] }> };

/** YouTube Channel subpaths proxied via the catch-all (run actions and channel resources). */
const ALLOWED_ROOTS = new Set([
  'advance',
  'pause',
  'resume',
  'cancel',
  'calendar',
  'videos',
  'queue',
  'reports',
  'leads',
  'quota',
  'analytics',
]);

function corePath(id: string, rest: string[]): string | null {
  if (rest.length === 0 || !ALLOWED_ROOTS.has(rest[0])) return null;
  const suffix = rest.map((part) => encodeURIComponent(part)).join('/');
  return `/api/aiva/youtube-channel/${encodeURIComponent(id)}/${suffix}`;
}

async function proxy(request: NextRequest, context: RouteContext) {
  const { id, rest } = await context.params;
  const path = corePath(id, rest ?? []);
  if (!path) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return handleAivaProxy(request, path);
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}
