import { NextRequest } from 'next/server';
import { handleAivaProxy } from '@/lib/aiva-route';

type Ctx = { params: Promise<{ path?: string[] }> };

function corePath(path: string[] | undefined): string {
  const suffix = path?.length ? `/${path.join('/')}` : '';
  return `/api/aiva/outreach${suffix}`;
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return handleAivaProxy(request, corePath(path));
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return handleAivaProxy(request, corePath(path));
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return handleAivaProxy(request, corePath(path));
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return handleAivaProxy(request, corePath(path));
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return handleAivaProxy(request, corePath(path));
}
