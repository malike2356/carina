import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { emailMessages } from '@/db/schema';
import type { EmailAttachmentMeta } from '@/lib/email-attachments';
import { emailBodyForDisplay, sanitizeEmailAddress } from '@/lib/email-text';

export type EmailOutboundSource = 'aiva' | 'google' | 'local';

export type UpsertOutboundEmailInput = {
  workspaceId: string;
  fromAddress: string;
  toAddress?: string | null;
  subject: string;
  body?: string | null;
  attachments?: EmailAttachmentMeta[] | null;
  externalId?: string | null;
  source: EmailOutboundSource;
  status?: 'sent' | 'inbox';
  receivedAt?: Date;
};

let schemaReady: Promise<void> | null = null;

/** Idempotent column ensure for environments that have not run vps-schema-patch yet. */
export function ensureEmailOutboundSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.execute(sql`ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS to_address text`);
      await db.execute(
        sql`ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS source varchar(30) DEFAULT 'local' NOT NULL`,
      );
      await db.execute(
        sql`ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS attachments jsonb`,
      );
      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS email_messages_external_id_idx ON email_messages (external_id)`,
      );
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

function previewOf(body: string, _toAddress?: string | null): string {
  // Never bake To: into the preview; the UI already shows addresses separately.
  return emailBodyForDisplay(body).replace(/\s+/g, ' ').trim().slice(0, 280);
}

/**
 * Insert or update a sent/imported mail row.
 * Prefer keeping source=aiva when the same Gmail id was already logged by an agent send.
 */
export async function upsertOutboundEmail(
  input: UpsertOutboundEmailInput,
): Promise<{ id: string; created: boolean }> {
  await ensureEmailOutboundSchema();

  const externalId = input.externalId?.trim() || null;
  const body = emailBodyForDisplay(input.body ?? '');
  const fromAddress = sanitizeEmailAddress(input.fromAddress) || input.fromAddress.trim() || 'unknown';
  const toAddress = sanitizeEmailAddress(input.toAddress) ?? null;
  const subject = input.subject.trim() || '(no subject)';
  const status = input.status ?? 'sent';
  const receivedAt = input.receivedAt ?? new Date();
  const attachments =
    input.attachments && input.attachments.length > 0 ? input.attachments : null;

  if (externalId) {
    const [existing] = await db
      .select()
      .from(emailMessages)
      .where(
        and(
          eq(emailMessages.workspaceId, input.workspaceId),
          eq(emailMessages.externalId, externalId),
        ),
      )
      .limit(1);

    if (existing) {
      const keepAiva = existing.source === 'aiva' && input.source === 'google';
      const [updated] = await db
        .update(emailMessages)
        .set({
          fromAddress,
          toAddress: toAddress || existing.toAddress,
          subject,
          bodyPreview: previewOf(body, toAddress ?? existing.toAddress),
          bodyFull: body || existing.bodyFull,
          attachments: attachments ?? existing.attachments ?? null,
          status: keepAiva ? existing.status : status,
          source: keepAiva ? 'aiva' : input.source,
          receivedAt: keepAiva ? existing.receivedAt : receivedAt,
        })
        .where(eq(emailMessages.id, existing.id))
        .returning({ id: emailMessages.id });
      return { id: updated.id, created: false };
    }
  }

  const [created] = await db
    .insert(emailMessages)
    .values({
      workspaceId: input.workspaceId,
      fromAddress,
      toAddress,
      subject,
      bodyPreview: previewOf(body, toAddress),
      bodyFull: body,
      attachments,
      externalId,
      source: input.source,
      status,
      urgency: 'normal',
      receivedAt,
    })
    .returning({ id: emailMessages.id });

  return { id: created.id, created: true };
}
