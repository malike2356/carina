import { NextRequest } from 'next/server';
import { handleAivaProxy } from '@/lib/aiva-route';

type RouteContext = { params: Promise<{ path?: string[] }> };

function depthPath(parts: string[] | undefined): string {
  const suffix = (parts ?? []).map((part) => encodeURIComponent(part)).join('/');
  return suffix ? `/api/aiva/${suffix}` : '/api/aiva/features';
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return handleAivaProxy(request, depthPath(path));
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return handleAivaProxy(request, depthPath(path));
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return handleAivaProxy(request, depthPath(path));
}
