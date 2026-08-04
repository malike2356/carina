import { NextRequest } from 'next/server';
import { handleAivaProxy } from '@/lib/aiva-route';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ workerId: string; senderId: string }> };

export async function DELETE(request: NextRequest, context: Ctx) {
  const { workerId, senderId } = await context.params;
  return handleAivaProxy(request, `/api/aiva/email/senders/${workerId}/${senderId}`);
}
