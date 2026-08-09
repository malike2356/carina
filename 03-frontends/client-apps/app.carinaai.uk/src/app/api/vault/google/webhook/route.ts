import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { documentVaultDriveConnections } from '@/db/schema';
import { verifyWatchToken } from '@/lib/document-vault/google/verification-token';
import { reconcileInbound } from '@/lib/document-vault/google/reconcile';
import { renewDriveWatchIfNeeded } from '@/lib/document-vault/google/watch';

export const dynamic = 'force-dynamic';

/**
 * Google Drive changes webhook (wakeup only).
 * Validates opaque channel token; enqueues/runs reconciliation; never trusts body for file diffs.
 */
export async function POST(request: Request) {
  const channelId = request.headers.get('x-goog-channel-id');
  const resourceId = request.headers.get('x-goog-resource-id');
  const resourceState = request.headers.get('x-goog-resource-state');
  const messageNumber = request.headers.get('x-goog-message-number');
  const channelToken = request.headers.get('x-goog-channel-token');

  if (!channelId) {
    return NextResponse.json({ error: 'missing channel' }, { status: 400 });
  }

  const [conn] = await db
    .select()
    .from(documentVaultDriveConnections)
    .where(eq(documentVaultDriveConnections.channelId, channelId))
    .limit(1);

  if (!conn?.connected) {
    return NextResponse.json({ ok: true, ignored: true });
  }
  if (resourceId && conn.resourceId && resourceId !== conn.resourceId) {
    return NextResponse.json({ error: 'resource mismatch' }, { status: 403 });
  }
  if (!verifyWatchToken(channelToken, conn.verificationTokenHash)) {
    return NextResponse.json({ error: 'invalid token' }, { status: 403 });
  }

  // Sync handshake / empty notifications: acknowledge only.
  if (resourceState === 'sync') {
    return NextResponse.json({ ok: true, sync: true });
  }

  const notificationId = `${channelId}:${messageNumber || resourceState || 'change'}:${resourceId || ''}`;
  try {
    const result = await reconcileInbound({
      workspaceId: conn.workspaceId,
      source: 'webhook',
      notificationId,
    });
    void renewDriveWatchIfNeeded(conn.workspaceId).catch(() => undefined);
    return NextResponse.json({
      ok: true,
      duplicate: result.duplicateNotification,
      applied: result.applied,
      conflicts: result.conflicts,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'reconcile failed';
    return NextResponse.json({ ok: false, error: message.slice(0, 200) }, { status: 500 });
  }
}
