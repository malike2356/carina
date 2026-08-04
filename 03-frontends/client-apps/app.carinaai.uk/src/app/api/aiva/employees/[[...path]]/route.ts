import { NextRequest } from 'next/server';
import { handleAivaProxy } from '@/lib/aiva-route';

type RouteContext = { params: Promise<{ path?: string[] }> };

function employeePath(parts: string[] | undefined): string {
  const suffix = (parts ?? []).map((part) => encodeURIComponent(part)).join('/');
  return suffix ? `/api/aiva/employees/${suffix}` : '/api/aiva/employees';
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return handleAivaProxy(request, employeePath(path));
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return handleAivaProxy(request, employeePath(path));
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return handleAivaProxy(request, employeePath(path));
}
