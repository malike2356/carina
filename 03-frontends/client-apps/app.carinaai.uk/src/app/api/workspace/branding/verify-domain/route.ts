import { NextRequest } from 'next/server';
import { handleWorkspaceProxy } from '@/lib/workspace-route';

export async function POST(request: NextRequest) {
  return handleWorkspaceProxy(request, '/api/workspace/branding/verify-domain');
}
