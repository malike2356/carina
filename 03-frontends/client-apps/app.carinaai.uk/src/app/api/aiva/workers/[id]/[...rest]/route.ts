import { NextRequest, NextResponse } from 'next/server';
import { handleAivaProxy } from '@/lib/aiva-route';

type RouteContext = { params: Promise<{ id: string; rest: string[] }> };

/** Worker subpaths proxied via the catch-all (tools, vault, chat thread, etc.). */
const ALLOWED_ROOTS = new Set([
  'tools',
  'vault',
  'skills',
  'onboarding',
  'whatsapp-number',
  'comanagers',
  'transfer',
  'memories',
  'learning',
  'direct-thread',
  'direct-messages',
  'direct-conversations',
  'chat-attachments',
  'spreadsheets',
  'channel-sync',
  'realtime',
  'voice',
]);

function corePath(workerId: string, rest: string[]): string | null {
  if (rest.length === 0 || !ALLOWED_ROOTS.has(rest[0])) return null;
  const suffix = rest.map((part) => encodeURIComponent(part)).join('/');
  return `/api/aiva/workers/${encodeURIComponent(workerId)}/${suffix}`;
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

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}
