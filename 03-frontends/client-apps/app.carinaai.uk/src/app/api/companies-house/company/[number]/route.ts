import { NextRequest } from 'next/server';
import { handleAivaProxy } from '@/lib/aiva-route';

type RouteContext = { params: Promise<{ number: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { number } = await context.params;
  const safe = encodeURIComponent(String(number || '').trim());
  return handleAivaProxy(request, `/api/companies-house/company/${safe}`);
}
