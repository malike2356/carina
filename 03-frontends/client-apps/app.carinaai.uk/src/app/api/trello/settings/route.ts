import { NextRequest, NextResponse } from 'next/server';
import { handleWorkspaceProxy } from '@/lib/workspace-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleWorkspaceProxy(request, '/api/trello/settings');
}

export async function PUT(request: NextRequest) {
  return handleWorkspaceProxy(request, '/api/trello/settings');
}

export async function DELETE(request: NextRequest) {
  return handleWorkspaceProxy(request, '/api/trello/settings');
}
