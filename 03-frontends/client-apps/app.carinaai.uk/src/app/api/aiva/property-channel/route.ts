import { NextRequest } from 'next/server';
import { handleAivaProxy } from '@/lib/aiva-route';

/** Legacy alias; prefer /api/aiva/youtube-channel. */
export async function GET(request: NextRequest) {
  return handleAivaProxy(request, '/api/aiva/youtube-channel');
}

export async function POST(request: NextRequest) {
  return handleAivaProxy(request, '/api/aiva/youtube-channel');
}
