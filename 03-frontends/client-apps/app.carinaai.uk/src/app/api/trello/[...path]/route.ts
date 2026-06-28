import { NextRequest } from 'next/server';
import { handleWorkspaceProxy } from '@/lib/workspace-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function buildPath(segments: string[]): string {
  return `/api/trello/${segments.map(encodeURIComponent).join('/')}`;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return handleWorkspaceProxy(request, buildPath(path));
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return handleWorkspaceProxy(request, buildPath(path));
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return handleWorkspaceProxy(request, buildPath(path));
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return handleWorkspaceProxy(request, buildPath(path));
}
