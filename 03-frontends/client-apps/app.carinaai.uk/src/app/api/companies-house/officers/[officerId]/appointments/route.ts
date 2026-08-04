import { NextRequest } from 'next/server';
import { handleAivaProxy } from '@/lib/aiva-route';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ officerId: string }> },
) {
  const { officerId } = await context.params;
  const encoded = encodeURIComponent(officerId);
  return handleAivaProxy(request, `/api/companies-house/officers/${encoded}/appointments`);
}
