import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { emailMessages } from '@/db/schema';

export type EmailOutboundSource = 'aiva' | 'google' | 'local';

export type UpsertOutboundEmailInput = {
  workspaceId: string;
  fromAddress: string;
  toAddress?: string | null;
  subject: string;
  body?: string | null;
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
        sql`CREATE INDEX IF NOT EXISTS email_messages_external_id_idx ON email_messages (external_id)`,
      );
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

function previewOf(body: string, toAddress?: string | null): string {
  const toLine = toAddress?.trim() ? `To: ${toAddress.trim()}\n\n` : '';
  return `${toLine}${body}`.slice(0, 500);
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
  const body = input.body ?? '';
  const subject = input.subject.trim() || '(no subject)';
  const status = input.status ?? 'sent';
  const receivedAt = input.receivedAt ?? new Date();

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
          fromAddress: input.fromAddress,
          toAddress: input.toAddress?.trim() || existing.toAddress,
          subject,
          bodyPreview: previewOf(body, input.toAddress ?? existing.toAddress),
          bodyFull: body || existing.bodyFull,
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
      externalId,
      fromAddress: input.fromAddress,
      toAddress: input.toAddress?.trim() || null,
      source: input.source,
      subject,
      bodyPreview: previewOf(body, input.toAddress),
      bodyFull: body,
      urgency: 'normal',
      status,
      receivedAt,
    })
    .returning({ id: emailMessages.id });

  return { id: created.id, created: true };
}
