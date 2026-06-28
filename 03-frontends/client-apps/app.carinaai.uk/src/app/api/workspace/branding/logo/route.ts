import { NextRequest } from 'next/server';
import { handleWorkspaceProxy } from '@/lib/workspace-route';

export async function POST(request: NextRequest) {
  return handleWorkspaceProxy(request, '/api/workspace/branding/logo');
}

export async function DELETE(request: NextRequest) {
  return handleWorkspaceProxy(request, '/api/workspace/branding/logo');
}
