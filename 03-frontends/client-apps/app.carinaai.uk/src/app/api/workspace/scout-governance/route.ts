import { NextRequest } from 'next/server';
import { handleWorkspaceProxy } from '@/lib/workspace-route';

export async function GET(request: NextRequest) {
  return handleWorkspaceProxy(request, '/api/workspace/scout-governance');
}

export async function PATCH(request: NextRequest) {
  return handleWorkspaceProxy(request, '/api/workspace/scout-governance');
}
