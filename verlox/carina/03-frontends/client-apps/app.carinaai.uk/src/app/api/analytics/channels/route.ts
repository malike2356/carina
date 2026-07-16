import { NextRequest } from 'next/server';
import { handleAnalyticsProxy } from '@/lib/analytics-proxy';

export async function GET(request: NextRequest) {
  return handleAnalyticsProxy(request, '/api/analytics/channels');
}
