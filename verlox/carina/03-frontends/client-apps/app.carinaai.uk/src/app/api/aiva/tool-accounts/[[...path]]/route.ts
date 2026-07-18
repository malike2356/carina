import { NextRequest } from 'next/server';
import { handleAivaProxy } from '@/lib/aiva-route';

type RouteContext = { params: Promise<{ path?: string[] }> };

function toolAccountsPath(parts: string[] | undefined): string {
  const suffix = (parts ?? []).map((part) => encodeURIComponent(part)).join('/');
  return suffix ? `/api/aiva/tool-accounts/${suffix}` : '/api/aiva/tool-accounts';
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return handleAivaProxy(request, toolAccountsPath(path));
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return handleAivaProxy(request, toolAccountsPath(path));
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return handleAivaProxy(request, toolAccountsPath(path));
}
