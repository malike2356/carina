import type { InboundMessage, AivaChannelName } from './types.js';
import { upsertThread, markChannelVerified } from './channel-store.js';
import { lookupWorker, type RegistryEntry } from './worker-registry.js';
import { processAivaMessage } from '../workers/aiva-process-message.js';
import { pool } from '../memory/db.js';
import { checkAndEnforceLimit, maybeSendUsageAlerts, recordManagedMessage } from '../usage/usage-service.js';
import { isOutboundApprovalChannel } from './approval-gated-channels.js';
import { handleSocialInboundReply } from '../ingestion/social/social-draft-handler.js';
import { sendOutboundReply } from './outbound-reply.js';
import type { SoftWallAction } from '../billing/usage-gate-policy.js';

export { sendOutboundReply };

const LIMIT_REPLY =
  'Managed AI credit for this workspace is used up. Connect your own API key to keep using Aiva, or upgrade and we handle the tokens.';

let inboundReceiptSchemaReady: Promise<void> | null = null;

function ensureInboundReceiptSchema(): Promise<void> {
  inboundReceiptSchemaReady ??= (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS channel_inbound_receipts (
        channel TEXT NOT NULL,
        external_message_id TEXT NOT NULL,
        worker_id UUID NOT NULL,
        received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (channel, worker_id, external_message_id)
      )
    `);
    // Older installs keyed only on (channel, message_id). Telegram message ids are
    // per-chat/per-bot, so that dropped other Aivas' messages as false duplicates.
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'channel_inbound_receipts_pkey'
            AND conrelid = 'channel_inbound_receipts'::regclass
            AND pg_get_constraintdef(oid) = 'PRIMARY KEY (channel, external_message_id)'
        ) THEN
          ALTER TABLE channel_inbound_receipts
            DROP CONSTRAINT channel_inbound_receipts_pkey;
          ALTER TABLE channel_inbound_receipts
            ADD PRIMARY KEY (channel, worker_id, external_message_id);
        END IF;
      END $$
    `);
  })();
  return inboundReceiptSchemaReady;
}

async function claimInboundMessage(
  message: InboundMessage,
  workerId: string,
): Promise<boolean> {
  const externalMessageId = message.threadId?.trim();
  if (!externalMessageId) return true;

  await ensureInboundReceiptSchema();
  const result = await pool.query(
    `INSERT INTO channel_inbound_receipts
       (channel, external_message_id, worker_id)
     VALUES ($1, $2, $3::uuid)
     ON CONFLICT (channel, worker_id, external_message_id) DO NOTHING
     RETURNING external_message_id`,
    [message.channel, externalMessageId, workerId],
  );
  const claimed = (result.rowCount ?? 0) > 0;
  console.info(
    `[channel-dedup] ${claimed ? 'claimed' : 'duplicate'} ${message.channel}:${externalMessageId}`,
  );
  return claimed;
}

function exhaustedReply(_actions?: SoftWallAction[]): string {
  if (!_actions?.length) return LIMIT_REPLY;
  return LIMIT_REPLY;
}

export async function routeInboundMessage(
  channel: AivaChannelName,
  identifier: string,
  buildMessage: (workerId: string, workspaceId: string) => InboundMessage | null,
  forcedEntry?: RegistryEntry,
): Promise<{
  handled: boolean;
  response?: string;
  entry?: RegistryEntry;
  actions?: SoftWallAction[];
}> {
  const entry = forcedEntry ?? lookupWorker(channel, identifier);
  if (!entry) {
    console.warn(`[channel-router] No Aiva found for ${channel}:${identifier}`);
    return { handled: false };
  }

  const message = buildMessage(entry.workerId, entry.workspaceId);
  if (!message) return { handled: false, entry };
  if (!(await claimInboundMessage(message, entry.workerId))) {
    return { handled: true, response: undefined, entry };
  }

  const overrideResult = await pool.query(
    `SELECT va_override FROM channel_threads
     WHERE worker_id = $1 AND contact_id = $2 AND channel = $3
     LIMIT 1`,
    [entry.workerId, message.contactId, message.channel],
  );
  if (Boolean(overrideResult.rows[0]?.va_override)) {
    return { handled: true, response: undefined, entry };
  }

  // workspaceId comes from the channel registry, never from the inbound payload.
  const limitCheck = await checkAndEnforceLimit(entry.workspaceId);
  if (!limitCheck.allowed) {
    void maybeSendUsageAlerts(entry.workspaceId).catch(() => {});
    return {
      handled: true,
      response: exhaustedReply(limitCheck.actions),
      entry,
      actions: limitCheck.actions,
    };
  }

  try {
    const { maybeInterceptInbound } = await import('../channel-shield/intercept.js');
    const shield = await maybeInterceptInbound({
      workspaceId: entry.workspaceId,
      channel: channel,
      externalKey: identifier,
      externalMessageId: String(message.threadId ?? `${channel}-${Date.now()}`),
      conversationId: String(message.threadId ?? message.contactId),
      from: { id: message.contactId, display: message.contactName },
      text: message.content,
      subject:
        message.channel === 'email'
          ? String((message.rawPayload as { Subject?: string })?.Subject ?? '').trim() || undefined
          : undefined,
      metadata: { workerId: entry.workerId },
    });
    if (shield.intercepted && !shield.allowLive) {
      return {
        handled: true,
        response:
          'Channel Shield held this message for security review. A safe summary was sent to your team.',
        entry,
      };
    }
  } catch (err) {
    console.warn('[channel-shield] intercept skipped', err);
  }

  const { getWorkerById } = await import('../workers/worker-store.js');
  const workerForPreview = await getWorkerById(entry.workerId).catch(() => null);
  const incognitoPreview = workerForPreview?.workerConfig?.privacy?.incognito === true;

  await upsertThread({
    workerId: entry.workerId,
    workspaceId: entry.workspaceId,
    channel: message.channel,
    contactId: message.contactId,
    threadId: message.threadId,
    preview: incognitoPreview ? '[incognito]' : message.content,
    emailSubject:
      message.channel === 'email'
        ? String((message.rawPayload as { Subject?: string })?.Subject ?? '').trim() || undefined
        : undefined,
  });

  const response = await processAivaMessage({
    workerId: entry.workerId,
    workspaceId: entry.workspaceId,
    userMessage: message.content,
    channel: message.channel,
    contactId: message.contactId,
    threadId: message.threadId,
    contactName: message.contactName,
    preferAudio: message.metadata?.preferAudio === 'true',
    contactMetadata: {
      telegramUserId: message.metadata?.telegramUserId,
      sessionToken: message.metadata?.sessionToken ?? message.threadId,
      email: message.metadata?.email,
      authenticatedUserId: message.metadata?.authenticatedUserId,
    },
  });

  if (response) {
    await recordManagedMessage(entry.workspaceId, {
      usePrepaid: limitCheck.usePrepaid,
      walletMode: limitCheck.walletMode,
    });
    void maybeSendUsageAlerts(entry.workspaceId).catch(() => {});
  }

  return { handled: true, response, entry };
}

/** Queue/steer system acks must not be sent to Telegram (or other external chats). */
function isInternalQueueAck(response: string): boolean {
  const trimmed = response.trim();
  return (
    /^\[Steer\]/i.test(trimmed)
    || /^\[Queued:/i.test(trimmed)
    || /^Message queued\.?$/i.test(trimmed)
    || /^Message dropped:/i.test(trimmed)
  );
}

export async function handleParsedInbound(
  message: InboundMessage,
  identifier: string,
  forcedEntry?: RegistryEntry,
): Promise<void> {
  const result = await routeInboundMessage(message.channel, identifier, () => message, forcedEntry);
  if (!result.handled || !result.response || !result.entry) return;

  if (isInternalQueueAck(result.response)) {
    console.info(
      `[channel-router] suppressed internal ack on ${message.channel}: ${result.response.slice(0, 80)}`,
    );
    return;
  }

  // Soft-wall / credit-exhausted notices must reach the user immediately.
  const isSystemGateReply =
    /managed AI credit/i.test(result.response)
    || /connect your own API key/i.test(result.response)
    || Boolean(result.actions?.length);

  if (isOutboundApprovalChannel(message.channel) && !isSystemGateReply) {
    await handleSocialInboundReply({
      message,
      entry: result.entry,
      draftText: result.response,
    });
    return;
  }

  await sendOutboundReply(message.channel, result.entry, message, result.response);
  if (result.entry.channelRowId) {
    void markChannelVerified(result.entry.channelRowId).catch(() => {});
  }
}
