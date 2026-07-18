import { NextRequest } from 'next/server';
import { handleAivaProxy } from '@/lib/aiva-route';

type RouteContext = { params: Promise<{ path?: string[] }> };

function assistPath(parts: string[] | undefined): string {
  const suffix = (parts ?? []).map((part) => encodeURIComponent(part)).join('/');
  return suffix ? `/api/aiva/human-assist/${suffix}` : '/api/aiva/human-assist/requests';
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return handleAivaProxy(request, assistPath(path ?? ['requests']));
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return handleAivaProxy(request, assistPath(path ?? ['requests']));
}
