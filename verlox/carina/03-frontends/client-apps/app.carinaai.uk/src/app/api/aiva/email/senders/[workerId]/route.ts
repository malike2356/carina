import { NextRequest } from 'next/server';
import { handleAivaProxy } from '@/lib/aiva-route';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ workerId: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  const { workerId } = await context.params;
  return handleAivaProxy(request, `/api/aiva/email/senders/${workerId}`);
}

export async function POST(request: NextRequest, context: Ctx) {
  const { workerId } = await context.params;
  return handleAivaProxy(request, `/api/aiva/email/senders/${workerId}`);
}
