import { randomUUID } from 'node:crypto';
import { pool } from '../db.js';
import { listActiveAuditorLinks } from './auditor-links.js';
import { calculateScoutScore, getComplianceScore } from './scoring.js';
import { getSecurityScore } from './security-score.js';
import { sendComplianceEmail } from './send-email.js';
import type { ComplianceScore, ScoutCombinedScore } from './types.js';

interface DigestSubscriber {
  email: string;
  user_id: string;
}

function buildDigestHtml(data: {
  scoutScore: ScoutCombinedScore;
  compliance: ComplianceScore;
  securityRisk: number;
  weeklyEvidenceCount: number;
  activeLinkCount: number;
  dashboardUrl: string;
}): string {
  const coverageLine = data.compliance.configured
    ? `${data.compliance.coveredControls}/${data.compliance.totalControls} controls (${data.compliance.coveragePercent}%)`
    : 'Not configured; enable evidence collection';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body { margin:0; padding:0; background:#0f172a; font-family:'Courier New',monospace; color:#e2e8f0; }
  .wrap { max-width:600px; margin:32px auto; background:#1e293b; border-radius:8px; overflow:hidden; }
  .hdr { background:#312e81; padding:20px 24px; }
  .hdr h1 { margin:0; font-size:16px; color:#fff; letter-spacing:1px; }
  .body { padding:24px; }
  .row { margin-bottom:14px; }
  .lbl { font-size:11px; color:#94a3b8; text-transform:uppercase; letter-spacing:1px; }
  .val { font-size:15px; margin-top:3px; }
  .footer { padding:16px 24px; border-top:1px solid #334155; }
  .footer a { color:#818cf8; text-decoration:none; font-size:13px; }
</style></head><body>
<div class="wrap">
  <div class="hdr"><h1>Scout Compliance Digest</h1></div>
  <div class="body">
    <div class="row"><div class="lbl">Scout Score</div><div class="val">${data.scoutScore.total}/100</div></div>
    <div class="row"><div class="lbl">Security</div><div class="val">${data.scoutScore.security}/100 (risk ${data.securityRisk})</div></div>
    <div class="row"><div class="lbl">Compliance</div><div class="val">${data.scoutScore.compliance}%</div></div>
    <div class="row"><div class="lbl">SOC2 Coverage</div><div class="val">${coverageLine}</div></div>
    <div class="row"><div class="lbl">Evidence This Week</div><div class="val">${data.weeklyEvidenceCount}</div></div>
    <div class="row"><div class="lbl">Active Auditor Links</div><div class="val">${data.activeLinkCount}</div></div>
  </div>
  <div class="footer"><a href="${data.dashboardUrl}">Open Scout Dashboard</a></div>
</div>
</body></html>`;
}

export async function sendComplianceDigest(): Promise<{ sent: number; skipped: number }> {
  const [compliance, security, activeLinks, subscribers] = await Promise.all([
    getComplianceScore(),
    getSecurityScore(),
    listActiveAuditorLinks(),
    pool.query<DigestSubscriber>(
      `SELECT email, user_id FROM compliance_digest_subscriptions WHERE enabled = TRUE`,
    ),
  ]);

  const scoutScore = calculateScoutScore(security.score, compliance);
  const weekAgo = new Date();
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);

  let weeklyEvidenceCount = 0;
  if (compliance.configured) {
    const weeklyResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM compliance_evidence
       WHERE collected_at >= $1`,
      [weekAgo.toISOString()],
    );
    weeklyEvidenceCount = parseInt(weeklyResult.rows[0]?.count ?? '0', 10);
  }

  const dashboardUrl = process.env.SCOUT_DASHBOARD_URL ?? 'https://console.labyrinthscout.com/dashboard';
  const weekLabel = new Date().toISOString().slice(0, 10);
  let sent = 0;
  let skipped = 0;

  for (const sub of subscribers.rows) {
    try {
      await sendComplianceEmail({
        to: sub.email,
        subject: `Scout Compliance Digest; Week of ${weekLabel}`,
        html: buildDigestHtml({
          scoutScore,
          compliance,
          securityRisk: security.riskScore,
          weeklyEvidenceCount,
          activeLinkCount: activeLinks.length,
          dashboardUrl,
        }),
      });
      await pool.query(
        `UPDATE compliance_digest_subscriptions SET last_sent_at = NOW() WHERE user_id = $1`,
        [sub.user_id],
      );
      sent += 1;
    } catch (err) {
      skipped += 1;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[compliance:digest] Failed for ${sub.email}:`, msg);
    }
  }

  return { sent, skipped };
}

export async function upsertDigestSubscription(userId: string, email: string): Promise<void> {
  await pool.query(
    `INSERT INTO compliance_digest_subscriptions (id, user_id, email, enabled)
     VALUES ($1, $2, $3, TRUE)
     ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, enabled = TRUE`,
    [randomUUID(), userId, email.trim().toLowerCase()],
  );
}
