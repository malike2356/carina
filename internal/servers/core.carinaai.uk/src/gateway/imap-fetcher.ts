import { config } from '../config/index.js';
import { upsertInboundEmail } from './email-store.js';

export async function fetchImapEmails(limit = 50): Promise<number> {
  if (!config.imap.host || !config.imap.user) return 0;
  const { ImapFlow } = await import('imapflow');
  const client = new ImapFlow({
    host: config.imap.host,
    port: config.imap.port,
    secure: config.imap.tls,
    auth: { user: config.imap.user, pass: config.imap.password },
    logger: false,
  });
  await client.connect();
  let count = 0;
  await client.mailboxOpen('INBOX');
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  for await (const msg of client.fetch({ seen: false, since }, { uid: true, envelope: true, source: true })) {
    const text = msg.source?.toString() ?? '';
    const bodyStart = text.indexOf('\r\n\r\n');
    const bodyText = bodyStart > -1
      ? text.slice(bodyStart + 4).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 10000)
      : '';
    const messageId = msg.envelope?.messageId ?? `imap-uid-${String(msg.uid)}`;
    await upsertInboundEmail({
      message_id: messageId,
      from_address: msg.envelope?.from?.[0]?.address ?? 'unknown',
      to_address: msg.envelope?.to?.[0]?.address ?? config.imap.user,
      subject: msg.envelope?.subject ?? null,
      body_text: bodyText || null,
      received_at: (msg.envelope?.date ?? new Date()).toISOString(),
    });
    if (++count >= limit) break;
  }
  await client.logout();
  return count;
}
