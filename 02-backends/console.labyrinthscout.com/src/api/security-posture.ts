import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import {
  countCriticalAttestations,
  verifyCriticalAttestation,
} from '../trust/critical-event-attestation.js';
import { getLastAttestationAt } from '../trust/load-trust-attestations.js';
import { pool } from '../db.js';

export const securityPostureRouter: IRouter = Router();

securityPostureRouter.get('/posture', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [critical24h, lastWeekly, recentCritical, injection24h] = await Promise.all([
      countCriticalAttestations(24),
      getLastAttestationAt(),
      pool.query<{ id: string; event_type: string; attested_at: Date }>(
        `SELECT id, event_type, attested_at
         FROM critical_event_attestations
         ORDER BY attested_at DESC
         LIMIT 5`,
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM security_events
         WHERE created_at > NOW() - INTERVAL '24 hours'
           AND event_type ~ 'injection'`,
      ),
    ]);

    res.json({
      ok: true,
      generated_at: new Date().toISOString(),
      critical_attestations_24h: critical24h,
      injection_blocks_24h: parseInt(injection24h.rows[0]?.count ?? '0', 10),
      weekly_on_chain: {
        status: lastWeekly ? 'partial' : 'unavailable',
        last_at: lastWeekly ? lastWeekly.toISOString() : null,
        note: lastWeekly
          ? 'Weekly on-chain batch available; per-event attestations are off-chain HMAC chain.'
          : 'No weekly on-chain attestation yet; run trust:attest when window is clean.',
      },
      critical_event_chain: {
        status: 'active',
        verify_path: '/api/security/attestations/:id/verify',
      },
      policy_evaluate_path: '/api/policy/evaluate',
      recent_critical_attestations: recentCritical.rows.map((row) => ({
        id: row.id,
        event_type: row.event_type,
        attested_at: new Date(row.attested_at).toISOString(),
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[security-posture] Failed:', msg);
    res.status(500).json({ ok: false, error: 'Security posture unavailable' });
  }
});

securityPostureRouter.get('/attestations/:id/verify', async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id ?? '');
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    res.status(400).json({ error: 'Invalid attestation id' });
    return;
  }
  try {
    const result = await verifyCriticalAttestation(id);
    res.json({
      ok: result.valid,
      valid: result.valid,
      reason: result.reason,
      attestation: result.attestation,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[security-posture] verify failed:', msg);
    res.status(500).json({ error: 'Verification unavailable' });
  }
});
