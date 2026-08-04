import { NextRequest } from 'next/server';
import { handleAivaProxy } from '@/lib/aiva-route';

export async function POST(request: NextRequest) {
  return handleAivaProxy(request, '/api/aiva/workspace/org-invites');
}
