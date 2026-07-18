import { NextRequest } from 'next/server';
import { handleAivaProxy } from '@/lib/aiva-route';

type RouteContext = { params: Promise<{ path?: string[] }> };

function assistsPath(parts: string[] | undefined): string {
  const suffix = (parts ?? []).map((part) => encodeURIComponent(part)).join('/');
  return suffix ? `/api/aiva/browser/assists/${suffix}` : '/api/aiva/browser/assists';
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return handleAivaProxy(request, assistsPath(path));
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return handleAivaProxy(request, assistsPath(path));
}
