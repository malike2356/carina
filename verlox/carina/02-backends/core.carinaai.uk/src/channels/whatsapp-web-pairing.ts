import { randomBytes } from 'crypto';
import { startBaileysPairingSession } from '../gateway/baileys/whatsapp-baileys.js';
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

function accountIdFor(input: { workspaceId: string; workerId: string }): string {
  return `aiva-${input.workspaceId}-${input.workerId}`.replace(/[^a-zA-Z0-9_-]/g, '-');
}

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
      await pool.query('ALTER TABLE aiva_whatsapp_web_sessions ADD COLUMN IF NOT EXISTS last_error TEXT');
    })();
  }
  return schemaReady;
}

async function updatePairingSession(
  id: string,
  input: {
    status?: WhatsAppWebPairingStatus;
    qrPayload?: string | null;
    pairingCode?: string | null;
    credentialRef?: string | null;
    lastError?: string | null;
  },
): Promise<void> {
  await pool.query(
    `UPDATE aiva_whatsapp_web_sessions
     SET status = COALESCE($2, status),
         qr_payload = CASE WHEN $3::BOOLEAN THEN $4 ELSE qr_payload END,
         pairing_code = CASE WHEN $5::BOOLEAN THEN $6 ELSE pairing_code END,
         credential_ref = COALESCE($7, credential_ref),
         last_error = CASE WHEN $8::BOOLEAN THEN $9 ELSE last_error END,
         updated_at = NOW()
     WHERE id = $1`,
    [
      id,
      input.status ?? null,
      Object.prototype.hasOwnProperty.call(input, 'qrPayload'),
      input.qrPayload ?? null,
      Object.prototype.hasOwnProperty.call(input, 'pairingCode'),
      input.pairingCode ?? null,
      input.credentialRef ?? null,
      Object.prototype.hasOwnProperty.call(input, 'lastError'),
      input.lastError ?? null,
    ],
  );
}

export async function startWhatsAppWebPairing(input: {
  workspaceId: string;
  workerId: string;
}): Promise<WhatsAppWebPairingSession> {
  await ensureWhatsAppWebPairingSchema();
  const pairingCode = randomBytes(4).toString('hex').toUpperCase();
  const accountId = accountIdFor(input);
  const result = await pool.query(
    `INSERT INTO aiva_whatsapp_web_sessions
       (workspace_id, worker_id, status, qr_payload, pairing_code, credential_ref, expires_at)
     VALUES ($1,$2,'pending',NULL,$3,$4,NOW() + INTERVAL '10 minutes')
     RETURNING *`,
    [input.workspaceId, input.workerId, pairingCode, accountId],
  );
  const sessionId = String(result.rows[0].id);

  let resolved = false;
  const finish = (resolve: () => void) => {
    if (!resolved) {
      resolved = true;
      resolve();
    }
  };

  await Promise.race([
    new Promise<void>((resolve) => {
      void startBaileysPairingSession({
        accountId,
        onUpdate: async (update) => {
          if (update.qr) {
            await updatePairingSession(sessionId, {
              status: 'qr_ready',
              qrPayload: update.qr,
              pairingCode,
              credentialRef: accountId,
              lastError: null,
            });
            finish(resolve);
            return;
          }
          if (update.connection === 'open') {
            await updatePairingSession(sessionId, {
              status: 'paired',
              qrPayload: null,
              pairingCode: null,
              credentialRef: accountId,
              lastError: null,
            });
            finish(resolve);
            return;
          }
          if (update.connection === 'close') {
            await updatePairingSession(sessionId, {
              status: 'disconnected',
              lastError: update.statusCode
                ? `Baileys disconnected with status ${update.statusCode}`
                : 'Baileys disconnected',
            });
            finish(resolve);
          }
        },
      }).catch(async (err) => {
        await updatePairingSession(sessionId, {
          status: 'disconnected',
          lastError: err instanceof Error ? err.message : String(err),
        });
        finish(resolve);
      });
    }),
    new Promise<void>((resolve) => setTimeout(resolve, 15_000)),
  ]);

  const latest = await getLatestWhatsAppWebPairing(input.workspaceId, input.workerId);
  return latest ?? rowToSession(result.rows[0]);
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
