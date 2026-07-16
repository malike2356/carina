import { NextRequest } from 'next/server';
import { handleWorkspaceProxy } from '@/lib/workspace-route';

export async function GET(request: NextRequest) {
  return handleWorkspaceProxy(request, '/api/workspace/workspace-capabilities');
}
