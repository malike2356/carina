import { config } from '../../config/index.js';
import { hubPool } from './migrations.js';

export interface PackSubmission {
  id: string;
  packName: string;
  version: string;
  authorHandle: string;
  authorEmail: string;
  description: string;
  category: string | null;
  pricingTier: string;
  priceGbpCents: number | null;
  authorShareBps: number;
  packArchiveUrl: string;
  status: 'pending' | 'approved' | 'rejected' | 'published';
  reviewerNotes: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  publishedAt: string | null;
}

const PACK_NAME_RE = /^[a-z0-9-]{3,48}$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SubmissionValidationError {
  field: string;
  message: string;
}

export function validateSubmissionInput(body: Record<string, unknown>): SubmissionValidationError[] {
  const errors: SubmissionValidationError[] = [];
  const packName = String(body.packName ?? '').trim();
  const version = String(body.version ?? '').trim();
  const authorHandle = String(body.authorHandle ?? '').trim();
  const authorEmail = String(body.authorEmail ?? '').trim();
  const description = String(body.description ?? '').trim();
  const pricingTier = String(body.pricingTier ?? 'free').trim();
  const priceGbpCents = body.priceGbpCents;
  const packArchiveUrl = String(body.packArchiveUrl ?? '').trim();

  if (!PACK_NAME_RE.test(packName)) errors.push({ field: 'packName', message: 'Must be 3-48 lowercase alphanumeric chars or hyphens.' });
  if (!SEMVER_RE.test(version)) errors.push({ field: 'version', message: 'Must be a semantic version e.g. 1.0.0.' });
  if (!authorHandle.trim()) errors.push({ field: 'authorHandle', message: 'Required.' });
  if (!EMAIL_RE.test(authorEmail)) errors.push({ field: 'authorEmail', message: 'Must be a valid email address.' });
  if (!description.trim()) errors.push({ field: 'description', message: 'Required.' });
  if (!['free', 'premium', 'certified'].includes(pricingTier)) errors.push({ field: 'pricingTier', message: 'Must be free, premium, or certified.' });
  if (pricingTier === 'premium' && (typeof priceGbpCents !== 'number' || priceGbpCents <= 0)) {
    errors.push({ field: 'priceGbpCents', message: 'Required and must be > 0 for premium packs.' });
  }
  if (!packArchiveUrl.startsWith('https://')) errors.push({ field: 'packArchiveUrl', message: 'Must start with https://.' });

  return errors;
}

function mapRow(row: Record<string, unknown>): PackSubmission {
  return {
    id: String(row.id),
    packName: String(row.pack_name),
    version: String(row.version),
    authorHandle: String(row.author_handle),
    authorEmail: String(row.author_email),
    description: String(row.description),
    category: row.category ? String(row.category) : null,
    pricingTier: String(row.pricing_tier),
    priceGbpCents: row.price_gbp_cents != null ? Number(row.price_gbp_cents) : null,
    authorShareBps: Number(row.author_share_bps),
    packArchiveUrl: String(row.pack_archive_url),
    status: String(row.status) as PackSubmission['status'],
    reviewerNotes: row.reviewer_notes ? String(row.reviewer_notes) : null,
    submittedAt: String(row.submitted_at),
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
    publishedAt: row.published_at ? String(row.published_at) : null,
  };
}

export async function createSubmission(input: {
  packName: string;
  version: string;
  authorHandle: string;
  authorEmail: string;
  description: string;
  category?: string;
  pricingTier: string;
  priceGbpCents?: number;
  packArchiveUrl: string;
}): Promise<PackSubmission> {
  const result = await hubPool.query(
    `INSERT INTO pack_submissions
       (pack_name, version, author_handle, author_email, description, category,
        pricing_tier, price_gbp_cents, pack_archive_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      input.packName, input.version, input.authorHandle, input.authorEmail,
      input.description, input.category ?? null, input.pricingTier,
      input.priceGbpCents ?? null, input.packArchiveUrl,
    ],
  );
  return mapRow(result.rows[0] as Record<string, unknown>);
}

export async function getSubmission(id: string): Promise<PackSubmission | null> {
  const result = await hubPool.query(
    `SELECT * FROM pack_submissions WHERE id = $1 LIMIT 1`,
    [id],
  );
  if ((result.rowCount ?? 0) === 0) return null;
  return mapRow(result.rows[0] as Record<string, unknown>);
}

export async function reviewSubmission(
  id: string,
  action: 'approve' | 'reject',
  reviewerNotes?: string,
): Promise<PackSubmission | null> {
  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  const result = await hubPool.query(
    `UPDATE pack_submissions
     SET status = $1, reviewed_at = NOW(), reviewer_notes = COALESCE($2, reviewer_notes)
     WHERE id = $3 AND status = 'pending'
     RETURNING *`,
    [newStatus, reviewerNotes ?? null, id],
  );
  if ((result.rowCount ?? 0) === 0) return null;
  return mapRow(result.rows[0] as Record<string, unknown>);
}

export async function publishSubmission(id: string): Promise<PackSubmission | null> {
  const sub = await getSubmission(id);
  if (!sub || sub.status !== 'approved') return null;

  await hubPool.query(
    `INSERT INTO skill_packs
       (name, version, description, author, category, archive_path,
        author_email, author_share_bps, pricing_tier, price_gbp_cents)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (name) DO UPDATE SET
       version = EXCLUDED.version,
       description = EXCLUDED.description,
       updated_at = NOW()`,
    [
      sub.packName, sub.version, sub.description, sub.authorHandle,
      sub.category ?? null, sub.packArchiveUrl,
      sub.authorEmail, sub.authorShareBps, sub.pricingTier,
      sub.priceGbpCents ?? null,
    ],
  );

  const result = await hubPool.query(
    `UPDATE pack_submissions
     SET status = 'published', published_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id],
  );
  return mapRow(result.rows[0] as Record<string, unknown>);
}

async function sendMarketplaceEmail(to: string, subject: string, text: string): Promise<void> {
  if (!config.resend.apiKey) return;
  const { Resend } = await import('resend');
  const resend = new Resend(config.resend.apiKey);
  await resend.emails.send({ from: 'Carina Marketplace <marketplace@carinaai.uk>', to, subject, text });
}

export async function sendSubmissionConfirmation(sub: PackSubmission): Promise<void> {
  await sendMarketplaceEmail(
    sub.authorEmail,
    `Submission received: ${sub.packName} v${sub.version}`,
    [
      `Hi ${sub.authorHandle},`,
      '',
      `We received your submission for "${sub.packName}" v${sub.version}.`,
      `Submission ID: ${sub.id}`,
      '',
      'Our team will review it within 5 business days. You will hear from us either way.',
      '',
      'Carina Marketplace',
    ].join('\n'),
  );
}

export async function sendRejectionEmail(sub: PackSubmission): Promise<void> {
  await sendMarketplaceEmail(
    sub.authorEmail,
    `Submission update: ${sub.packName} v${sub.version}`,
    [
      `Hi ${sub.authorHandle},`,
      '',
      `After review, we were unable to approve "${sub.packName}" v${sub.version}.`,
      '',
      sub.reviewerNotes ? `Reviewer notes: ${sub.reviewerNotes}` : 'Please contact marketplace@carinaai.uk if you have questions.',
      '',
      'You may revise and resubmit at any time.',
      '',
      'Carina Marketplace',
    ].join('\n'),
  );
}

export async function sendPublicationEmail(sub: PackSubmission): Promise<void> {
  await sendMarketplaceEmail(
    sub.authorEmail,
    `Your pack is live: ${sub.packName}`,
    [
      `Hi ${sub.authorHandle},`,
      '',
      `"${sub.packName}" v${sub.version} is now published on the Carina Marketplace.`,
      '',
      'Thank you for contributing to the ecosystem.',
      '',
      'Carina Marketplace',
    ].join('\n'),
  );
}
