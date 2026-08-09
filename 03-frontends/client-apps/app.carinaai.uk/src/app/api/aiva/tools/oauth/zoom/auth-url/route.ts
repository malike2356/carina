import { NextRequest } from 'next/server';
import { handleAivaProxy } from '@/lib/aiva-route';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleAivaProxy(request, '/api/aiva/tools/oauth/zoom/auth-url');
}
