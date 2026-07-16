import { pool } from '../db.js';
import { recordProtectAuditEvent } from '../protect/protect-audit.js';

export type PlaneVerdict = 'verified' | 'unverified' | 'disagreement';

export async function getVerdictSummary(accountId: string, days = 30): Promise<{
  totalEnforcements: number;
  verified: number;
  unverified: number;
  disagreements: number;
  verifiedPercent: number;
}> {
  const result = await pool.query<{ verdict: string; count: string }>(
    `SELECT verdict, COUNT(*)::text AS count
     FROM plane_verdicts
     WHERE account_id = $1
       AND created_at >= NOW() - ($2::text || ' days')::interval
     GROUP BY verdict`,
    [accountId, String(days)],
  );
  const counts = Object.fromEntries(result.rows.map((r) => [r.verdict, parseInt(r.count, 10)]));
  const verified = counts.verified ?? 0;
  const unverified = counts.unverified ?? 0;
  const disagreements = counts.disagreement ?? 0;
  const totalEnforcements = verified + unverified + disagreements;
  return {
    totalEnforcements,
    verified,
    unverified,
    disagreements,
    verifiedPercent:
      totalEnforcements > 0 ? Math.round((verified / totalEnforcements) * 100) : 0,
  };
}

export async function insertPlaneVerdict(input: {
  accountId: string;
  appEventId?: string | null;
  sensorEventIds?: string[];
  verdict: PlaneVerdict;
  disagreementReason?: string | null;
}): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO plane_verdicts (
       account_id, app_event_id, sensor_event_ids, verdict, disagreement_reason
     ) VALUES ($1, $2::uuid, $3::uuid[], $4, $5)
     RETURNING id`,
    [
      input.accountId,
      input.appEventId ?? null,
      input.sensorEventIds ?? null,
      input.verdict,
      input.disagreementReason ?? null,
    ],
  );
  return result.rows[0]!.id;
}

/**
 * Two-plane verify for session block (AI Security OS 07).
 *
 * Application plane: blocked_sessions row exists (runtime/control reported).
 * Independent plane: Scout re-reads blocked_sessions after delayMs (observer outside agent process).
 *
 * Limitations (honest):
 * - Does not yet observe the remote Carina process memory; Redis pub/sub delivery is not proven here.
 * - Sensor-plane ack is optional; without sensor_id we only do DB re-read independence.
 * - Timing window can race with operator release.
 */
export async function verifySessionBlockTwoPlane(input: {
  accountId: string;
  sessionId: string;
  appEventId?: string | null;
  delayMs?: number;
}): Promise<{ verdict: PlaneVerdict; verdictId: string; reason?: string }> {
  const delayMs = input.delayMs ?? 50;

  const appPlane = await pool.query(
    `SELECT session_id FROM blocked_sessions WHERE session_id = $1 LIMIT 1`,
    [input.sessionId],
  );
  const appBlocked = Boolean(appPlane.rows[0]);

  await new Promise((r) => setTimeout(r, delayMs));

  const independent = await pool.query(
    `SELECT session_id, reason, blocked_at FROM blocked_sessions WHERE session_id = $1 LIMIT 1`,
    [input.sessionId],
  );
  const stillBlocked = Boolean(independent.rows[0]);

  let verdict: PlaneVerdict;
  let disagreementReason: string | null = null;

  if (appBlocked && stillBlocked) {
    verdict = 'verified';
  } else if (!appBlocked && !stillBlocked) {
    verdict = 'unverified';
    disagreementReason = 'Application plane never recorded block';
  } else {
    verdict = 'disagreement';
    disagreementReason = appBlocked
      ? 'Independent plane: blocked_sessions missing after delay (possible bypass or race)'
      : 'Independent plane sees block but application plane did not report it';
  }

  const verdictId = await insertPlaneVerdict({
    accountId: input.accountId,
    appEventId: input.appEventId,
    verdict,
    disagreementReason,
  });

  if (verdict === 'disagreement') {
    await recordProtectAuditEvent({
      eventType: 'plane_disagreement',
      severity: 'critical',
      description: `Two-plane disagreement on session_block ${input.sessionId}: ${disagreementReason}`,
      accountId: input.accountId,
      sessionId: input.sessionId,
      metadata: {
        action_class: 'session_block',
        verdict,
        disagreement_reason: disagreementReason,
        incident_hint: 'type2',
        verdict_id: verdictId,
      },
    });
  }

  return { verdict, verdictId, reason: disagreementReason ?? undefined };
}
