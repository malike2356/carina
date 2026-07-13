import { randomBytes, randomUUID } from 'crypto';
import { pool } from '../memory/db.js';

export type WhatsAppWebPairingStatus =
  | 'pending'
  | 'qr_ready'
  | 'paired'
  | 'disconnected'
  | 'expired'
  | 'revoked';

export interface WhatsAppWebPairingSession {
  id: string;
  workspaceId: string;
  workerId: string;
  status: WhatsAppWebPairingStatus;
  qrPayload: string | null;
  pairingCode: string | null;
  phoneNumber: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  warnings: string[];
}

let schemaReady: Promise<void> | null = null;

function rowToSession(row: Record<string, unknown>): WhatsAppWebPairingSession {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    workerId: String(row.worker_id),
    status: String(row.status) as WhatsAppWebPairingStatus,
    qrPayload: row.qr_payload ? String(row.qr_payload) : null,
    pairingCode: row.pairing_code ? String(row.pairing_code) : null,
    phoneNumber: row.phone_number ? String(row.phone_number) : null,
    expiresAt: new Date(String(row.expires_at)).toISOString(),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    warnings: whatsappWebOperationalWarnings(),
  };
}

export function whatsappWebOperationalWarnings(): string[] {
  return [
    'WhatsApp Web pairing is easier for early testing, but it is not the official WhatsApp Business API.',
    'WhatsApp can change Web behaviour without notice; reconnect or re-pair may be required.',
    'Do not use this path for spam, cold outreach, or high-volume automation.',
    'For production scale, compliance, templates, and business messaging, use the official WhatsApp Business API.',
  ];
}

export async function ensureWhatsAppWebPairingSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS aiva_whatsapp_web_sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID NOT NULL,
          worker_id UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
          status TEXT NOT NULL DEFAULT 'pending',
          qr_payload TEXT,
          pairing_code TEXT,
          phone_number TEXT,
          credential_ref TEXT,
          expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await pool.query('CREATE INDEX IF NOT EXISTS aiva_whatsapp_web_sessions_worker_idx ON aiva_whatsapp_web_sessions (workspace_id, worker_id, created_at DESC)');
    })();
  }
  return schemaReady;
}

export async function startWhatsAppWebPairing(input: {
  workspaceId: string;
  workerId: string;
}): Promise<WhatsAppWebPairingSession> {
  await ensureWhatsAppWebPairingSchema();
  const nonce = randomBytes(18).toString('base64url');
  const pairingCode = randomBytes(4).toString('hex').toUpperCase();
  const qrPayload = JSON.stringify({
    type: 'carina_whatsapp_web_pairing',
    session: randomUUID(),
    nonce,
    workerId: input.workerId,
  });
  const result = await pool.query(
    `INSERT INTO aiva_whatsapp_web_sessions
       (workspace_id, worker_id, status, qr_payload, pairing_code, expires_at)
     VALUES ($1,$2,'qr_ready',$3,$4,NOW() + INTERVAL '10 minutes')
     RETURNING *`,
    [input.workspaceId, input.workerId, qrPayload, pairingCode],
  );
  return rowToSession(result.rows[0]);
}

export async function getLatestWhatsAppWebPairing(
  workspaceId: string,
  workerId: string,
): Promise<WhatsAppWebPairingSession | null> {
  await ensureWhatsAppWebPairingSchema();
  const result = await pool.query(
    `SELECT *,
            CASE
              WHEN status IN ('pending','qr_ready') AND expires_at < NOW() THEN 'expired'
              ELSE status
            END AS status
     FROM aiva_whatsapp_web_sessions
     WHERE workspace_id = $1 AND worker_id = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [workspaceId, workerId],
  );
  return result.rows[0] ? rowToSession(result.rows[0]) : null;
}

export async function revokeWhatsAppWebPairing(
  workspaceId: string,
  workerId: string,
): Promise<WhatsAppWebPairingSession | null> {
  await ensureWhatsAppWebPairingSchema();
  const result = await pool.query(
    `UPDATE aiva_whatsapp_web_sessions
     SET status = 'revoked', qr_payload = NULL, pairing_code = NULL, updated_at = NOW()
     WHERE id = (
       SELECT id FROM aiva_whatsapp_web_sessions
       WHERE workspace_id = $1 AND worker_id = $2
       ORDER BY created_at DESC
       LIMIT 1
     )
     RETURNING *`,
    [workspaceId, workerId],
  );
  return result.rows[0] ? rowToSession(result.rows[0]) : null;
}
