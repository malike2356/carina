import { pool } from '../../memory/db.js';
import { countPendingSocialApprovals, listPendingSocialApprovals } from '../../ingestion/social/social-approval-store.js';

export async function buildSocialDigest(workspaceId: string, workerId?: string): Promise<{
  pendingCount: number;
  overnightInboundCount: number;
  pendingPosts: number;
  pendingDms: number;
  approvals: Array<{
    id: string;
    channel: string;
    messageType: string;
    draftPreview: string;
    requestedAt: string;
  }>;
}> {
  const pending = await listPendingSocialApprovals(workspaceId, { workerId, limit: 20 });
  const overnightResult = await pool.query(
    `SELECT COUNT(*)::int AS count FROM worker_social_approvals
     WHERE workspace_id = $1
       AND requested_at >= NOW() - INTERVAL '24 hours'
       ${workerId ? 'AND worker_id = $2' : ''}`,
    workerId ? [workspaceId, workerId] : [workspaceId],
  );
  const overnightInboundCount = Number(overnightResult.rows[0]?.count ?? 0);
  const pendingCount = await countPendingSocialApprovals(workspaceId);

  return {
    pendingCount,
    overnightInboundCount,
    pendingPosts: pending.filter((item) => item.messageType === 'post').length,
    pendingDms: pending.filter((item) => item.messageType !== 'post').length,
    approvals: pending.map((item) => ({
      id: item.id,
      channel: item.channel,
      messageType: item.messageType,
      draftPreview: item.draftText.slice(0, 200),
      requestedAt: item.requestedAt.toISOString(),
    })),
  };
}
