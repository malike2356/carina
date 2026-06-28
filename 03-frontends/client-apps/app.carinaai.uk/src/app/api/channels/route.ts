import { NextRequest } from 'next/server';
import { handleAivaProxy } from '@/lib/aiva-route';

export async function GET(request: NextRequest) {
  return handleAivaProxy(request, '/api/channels');
}

export async function POST(request: NextRequest) {
  return handleAivaProxy(request, '/api/channels');
}
