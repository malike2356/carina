export interface ImapConnectionParams {
  host: string;
  port: number;
  tls: boolean;
  username: string;
  password: string;
}

export interface RawImapMessage {
  uid: number;
  messageId: string;
  fromAddress: string;
  subject: string;
  bodyText: string;
  receivedAt: Date;
}

export async function testImapConnection(params: ImapConnectionParams): Promise<{ ok: boolean; mailbox?: string; error?: string }> {
  try {
    const { ImapFlow } = await import('imapflow');
    const client = new ImapFlow({
      host: params.host,
      port: params.port,
      secure: params.tls,
      auth: { user: params.username, pass: params.password },
      logger: false,
    });
    await client.connect();
    const mailbox = await client.mailboxOpen('INBOX');
    const name = mailbox.path;
    await client.logout();
    return { ok: true, mailbox: name };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export async function fetchUnseenFromSenders(
  params: ImapConnectionParams,
  allowedSenders: string[],
  limit = 25,
): Promise<RawImapMessage[]> {
  if (allowedSenders.length === 0) return [];

  const normalized = allowedSenders.map((s) => s.trim().toLowerCase());
  const { ImapFlow } = await import('imapflow');
  const client = new ImapFlow({
    host: params.host,
    port: params.port,
    secure: params.tls,
    auth: { user: params.username, pass: params.password },
    logger: false,
  });

  const messages: RawImapMessage[] = [];
  await client.connect();
  try {
    await client.mailboxOpen('INBOX');
    for await (const msg of client.fetch({ seen: false }, { uid: true, envelope: true, source: true })) {
      const fromAddress = msg.envelope?.from?.[0]?.address?.toLowerCase() ?? '';
      if (!senderMatches(fromAddress, normalized)) {
        continue;
      }

      const text = msg.source?.toString() ?? '';
      const bodyStart = text.indexOf('\r\n\r\n');
      const bodyText = bodyStart > -1
        ? text.slice(bodyStart + 4).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 12000)
        : '';

      messages.push({
        uid: Number(msg.uid),
        messageId: msg.envelope?.messageId ?? `imap-uid-${String(msg.uid)}`,
        fromAddress: msg.envelope?.from?.[0]?.address ?? 'unknown',
        subject: msg.envelope?.subject ?? '',
        bodyText,
        receivedAt: msg.envelope?.date ?? new Date(),
      });

      if (messages.length >= limit) break;
    }
  } finally {
    await client.logout();
  }

  return messages;
}

export function senderMatches(fromAddress: string, allowedSenders: string[]): boolean {
  const from = fromAddress.trim().toLowerCase();
  return allowedSenders.some((sender) => {
    const normalized = sender.trim().toLowerCase();
    if (!normalized) return false;
    if (from === normalized) return true;
    if (normalized.startsWith('@')) {
      return from.endsWith(normalized);
    }
    return false;
  });
}

export async function markMessagesSeen(
  params: ImapConnectionParams,
  uids: number[],
): Promise<void> {
  if (uids.length === 0) return;

  const { ImapFlow } = await import('imapflow');
  const client = new ImapFlow({
    host: params.host,
    port: params.port,
    secure: params.tls,
    auth: { user: params.username, pass: params.password },
    logger: false,
  });

  await client.connect();
  try {
    await client.mailboxOpen('INBOX');
    const uidSequence = uids.join(',');
    await client.messageFlagsAdd({ uid: uidSequence }, ['\\Seen'], { uid: true });
  } finally {
    await client.logout();
  }
}
