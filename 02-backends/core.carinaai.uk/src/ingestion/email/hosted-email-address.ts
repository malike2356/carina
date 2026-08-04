import { randomBytes } from 'node:crypto';
import { pool } from '../../memory/db.js';

export type HostedEmailAddress = {
  id: string;
  workspaceId: string;
  workerId: string;
  address: string;
  localPart: string;
  domain: string;
  provider: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type HostedEmailStats = {
  lastInboundAt: string | null;
  lastInboundRecipient: string | null;
  unknownRecipientCount: number;
  acceptedCount: number;
};

const inboundStats: HostedEmailStats = {
  lastInboundAt: null,
  lastInboundRecipient: null,
  unknownRecipientCount: 0,
  acceptedCount: 0,
};

let schemaReady: Promise<void> | null = null;

export function isHostedEmailEnabled(): boolean {
  const raw = process.env.AIVA_HOSTED_EMAIL_ENABLED?.trim().toLowerCase();
  if (raw === 'false' || raw === '0' || raw === 'off') return false;
  return true;
}

export function hostedEmailDomain(): string {
  const configured = process.env.AIVA_HOSTED_EMAIL_DOMAIN?.trim().toLowerCase();
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') return 'inbox.hireaiva.co.uk';
  return 'mail.carinaai.uk';
}

export function hostedEmailProvider(): string {
  return process.env.AIVA_HOSTED_EMAIL_PROVIDER?.trim().toLowerCase() || 'cloudflare';
}

export function getHostedEmailStats(): HostedEmailStats {
  return { ...inboundStats };
}

export function recordHostedEmailInbound(meta: {
  accepted: boolean;
  recipient?: string;
}): void {
  inboundStats.lastInboundAt = new Date().toISOString();
  if (meta.recipient) {
    inboundStats.lastInboundRecipient = meta.recipient.toLowerCase();
  }
  if (meta.accepted) inboundStats.acceptedCount += 1;
  else inboundStats.unknownRecipientCount += 1;
}

function ensureSchema(): Promise<void> {
  schemaReady ??= pool
    .query(`
      CREATE TABLE IF NOT EXISTS aiva_hosted_email_addresses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL,
        worker_id UUID NOT NULL,
        address TEXT NOT NULL,
        local_part TEXT NOT NULL,
        domain TEXT NOT NULL,
        provider TEXT NOT NULL DEFAULT 'cloudflare',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT aiva_hosted_email_addresses_address_unique UNIQUE (address),
        CONSTRAINT aiva_hosted_email_addresses_local_part_unique UNIQUE (local_part),
        CONSTRAINT aiva_hosted_email_addresses_worker_unique UNIQUE (worker_id)
      );
      CREATE INDEX IF NOT EXISTS aiva_hosted_email_addresses_workspace_idx
        ON aiva_hosted_email_addresses (workspace_id);
      CREATE INDEX IF NOT EXISTS aiva_hosted_email_addresses_status_idx
        ON aiva_hosted_email_addresses (status);
    `)
    .then(() => undefined);
  return schemaReady;
}

function rowToAddress(row: Record<string, unknown>): HostedEmailAddress {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    workerId: String(row.worker_id),
    address: String(row.address),
    localPart: String(row.local_part),
    domain: String(row.domain),
    provider: String(row.provider ?? 'cloudflare'),
    status: String(row.status ?? 'active'),
    createdAt: new Date(String(row.created_at ?? Date.now())),
    updatedAt: new Date(String(row.updated_at ?? Date.now())),
  };
}

/** Human-readable local-part slug from a worker display name. */
export function slugifyWorkerName(workerName: string): string {
  return (
    workerName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 20) || 'aiva'
  );
}

export function shortWorkerSuffix(workerId: string): string {
  return workerId.replace(/-/g, '').slice(0, 6).toLowerCase();
}

export function buildHostedLocalPart(
  workerName: string,
  workerId: string,
  collisionSalt?: string,
): string {
  const base = slugifyWorkerName(workerName);
  const suffix = shortWorkerSuffix(workerId);
  const salt = collisionSalt ? `-${collisionSalt}` : '';
  return `${base}-${suffix}${salt}`.slice(0, 64);
}

/** Extract bare email from `Name <addr@host>` or plain address. */
export function normalizeEmailRecipient(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const angle = trimmed.match(/<([^>]+)>/);
  const candidate = (angle?.[1] ?? trimmed).trim().toLowerCase();
  if (!candidate.includes('@')) return null;
  // Drop display-name leftovers and group syntax.
  const cleaned = candidate.replace(/^["']+|["']+$/g, '').split(/[\s,;]/)[0] ?? '';
  if (!cleaned.includes('@')) return null;
  return cleaned;
}

export async function getHostedEmailAddressForWorker(
  workerId: string,
): Promise<HostedEmailAddress | null> {
  await ensureSchema();
  const result = await pool.query(
    `SELECT * FROM aiva_hosted_email_addresses WHERE worker_id = $1 LIMIT 1`,
    [workerId],
  );
  if (result.rows.length === 0) return null;
  return rowToAddress(result.rows[0]);
}

export async function findHostedEmailAddressByRecipient(
  toAddress: string,
): Promise<HostedEmailAddress | null> {
  await ensureSchema();
  const normalized = normalizeEmailRecipient(toAddress);
  if (!normalized) return null;

  const result = await pool.query(
    `SELECT * FROM aiva_hosted_email_addresses
     WHERE lower(address) = $1
     LIMIT 1`,
    [normalized],
  );
  if (result.rows.length === 0) return null;
  const row = rowToAddress(result.rows[0]);
  if (row.status !== 'active') return null;
  return row;
}

function isUniqueViolation(err: unknown): boolean {
  return Boolean(
    err
    && typeof err === 'object'
    && 'code' in err
    && (err as { code?: string }).code === '23505',
  );
}

export async function ensureHostedEmailAddressForWorker(params: {
  workspaceId: string;
  workerId: string;
  workerName: string;
}): Promise<HostedEmailAddress | null> {
  if (!isHostedEmailEnabled()) return null;

  await ensureSchema();
  const existing = await getHostedEmailAddressForWorker(params.workerId);
  if (existing) return existing;

  const domain = hostedEmailDomain();
  const provider = hostedEmailProvider();
  const maxAttempts = 8;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const salt = attempt === 0 ? undefined : randomBytes(2).toString('hex');
    const localPart = buildHostedLocalPart(params.workerName, params.workerId, salt);
    const address = `${localPart}@${domain}`;

    try {
      const result = await pool.query(
        `INSERT INTO aiva_hosted_email_addresses
           (workspace_id, worker_id, address, local_part, domain, provider, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'active')
         ON CONFLICT (worker_id) DO UPDATE
           SET updated_at = aiva_hosted_email_addresses.updated_at
         RETURNING *`,
        [params.workspaceId, params.workerId, address, localPart, domain, provider],
      );
      return rowToAddress(result.rows[0]);
    } catch (err) {
      if (isUniqueViolation(err)) {
        const raced = await getHostedEmailAddressForWorker(params.workerId);
        if (raced) return raced;
        continue;
      }
      throw err;
    }
  }

  throw new Error('Unable to allocate hosted email address after collision retries');
}

export async function backfillHostedEmailAddresses(): Promise<{
  scanned: number;
  created: number;
  skipped: number;
  errors: number;
}> {
  await ensureSchema();
  if (!isHostedEmailEnabled()) {
    return { scanned: 0, created: 0, skipped: 0, errors: 0 };
  }

  const workers = await pool.query(
    `SELECT w.id, w.workspace_id, w.name
     FROM ai_workers w
     LEFT JOIN aiva_hosted_email_addresses h ON h.worker_id = w.id
     WHERE h.id IS NULL
       AND COALESCE(w.status, 'active') NOT IN ('deleted', 'archived')
     ORDER BY w.created_at ASC NULLS LAST`,
  );

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of workers.rows) {
    try {
      const before = await getHostedEmailAddressForWorker(String(row.id));
      const address = await ensureHostedEmailAddressForWorker({
        workspaceId: String(row.workspace_id),
        workerId: String(row.id),
        workerName: String(row.name ?? 'aiva'),
      });
      if (!address) {
        skipped += 1;
        continue;
      }
      if (before) skipped += 1;
      else created += 1;
    } catch (err) {
      errors += 1;
      console.warn(
        '[hosted-email] backfill failed for worker',
        String(row.id),
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return {
    scanned: workers.rows.length,
    created,
    skipped,
    errors,
  };
}

export function hostedEmailOperatorStatus(): {
  enabled: boolean;
  domain: string;
  provider: string;
  inboundSecretPresent: boolean;
  lastInboundAt: string | null;
  unknownRecipientCount: number;
  acceptedCount: number;
} {
  const provider = hostedEmailProvider();
  const mailgunKeyPresent = Boolean(process.env.MAILGUN_WEBHOOK_SIGNING_KEY?.trim());
  const cloudflareSecretPresent = Boolean(
    process.env.CLOUDFLARE_EMAIL_WORKER_SECRET?.trim()
    || process.env.AIVA_CLOUDFLARE_EMAIL_SECRET?.trim(),
  );
  return {
    enabled: isHostedEmailEnabled(),
    domain: hostedEmailDomain(),
    provider,
    inboundSecretPresent: provider === 'mailgun' ? mailgunKeyPresent : cloudflareSecretPresent,
    lastInboundAt: inboundStats.lastInboundAt,
    unknownRecipientCount: inboundStats.unknownRecipientCount,
    acceptedCount: inboundStats.acceptedCount,
  };
}
