import type { NextRequest } from 'next/server';
import { handleAivaProxy } from '@/lib/aiva-route';

type Ctx = { params: Promise<{ path?: string[] }> };

async function proxy(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  const suffix = path?.length ? `/${path.join('/')}` : '';
  const url = new URL(request.url);
  return handleAivaProxy(request, `/api/aiva/email-shield${suffix}${url.search}`);
}

export async function GET(request: NextRequest, ctx: Ctx) {
  return proxy(request, ctx);
}

export async function POST(request: NextRequest, ctx: Ctx) {
  return proxy(request, ctx);
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  return proxy(request, ctx);
}
