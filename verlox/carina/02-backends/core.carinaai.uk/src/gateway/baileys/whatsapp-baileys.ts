import chalk from 'chalk';
import path from 'path';
import fs from 'fs/promises';
import { channelRegistry } from '../channels/channel-registry.js';
import { getRouter } from '../router.js';
import type { ChannelMessage, IChannelAdapter, SendOptions } from '../channels/channel-adapter.interface.js';
import { formatForChannel } from '../channels/channel-formatter.js';
import { saveInboundMedia, transcribeInboundAudio } from './whatsapp-media.js';
import { findContact } from '../../profiles/contacts.js';
import { resolveCarinaDataDir } from '../../config/paths.js';
import { reportEvent } from '../../security/scout-client.js';
import { requireSessionSecret, useEncryptedAuthState } from './session-store.js';

type BaileysModule = {
  default: (opts: Record<string, unknown>) => BaileysSocket;
  fetchLatestBaileysVersion: () => Promise<{ version: number[] }>;
  makeCacheableSignalKeyStore: (state: unknown, logger: unknown) => unknown;
  downloadMediaMessage: (
    msg: Record<string, unknown>,
    type: string,
    opts: Record<string, unknown>,
    ctx: Record<string, unknown>,
  ) => Promise<Buffer>;
  DisconnectReason: { loggedOut: number; restartRequired: number };
  getContentType: (content: Record<string, unknown>) => string | undefined;
};

type BaileysSocket = {
  ev: { on: (event: string, handler: (...args: unknown[]) => void) => void };
  sendMessage: (jid: string, content: Record<string, unknown>) => Promise<unknown>;
  logout: () => Promise<void>;
  end: (error?: Error) => void;
};

export interface BaileysPairingUpdate {
  accountId: string;
  qr?: string;
  connection?: string;
  statusCode?: number;
}

const baileysSockets = new Map<string, BaileysSocket>();
let reconnectAttempts = 0;

export class BaileysWhatsAppAdapter implements IChannelAdapter {
  readonly name = 'whatsapp' as const;
  private readonly socketKey: string;

  constructor(readonly enabled: boolean, socketKey = 'default') {
    this.socketKey = socketKey;
  }

  private get sock() {
    return baileysSockets.get(this.socketKey) ?? null;
  }

  parseInbound(raw: unknown): ChannelMessage | null {
    const p = raw as Record<string, unknown>;
    const text = String(p.text ?? p.body ?? '').trim();
    const from = String(p.from ?? p.remoteJid ?? '');
    if (!text || !from) return null;
    const isGroup = Boolean(p.isGroup ?? from.endsWith('@g.us'));
    const participant = String(p.participant ?? p.sender ?? from);
    const externalUserId = isGroup ? participant : from;
    return {
      id: String(p.id ?? Date.now()),
      channel: 'whatsapp',
      externalUserId,
      conversationId: from,
      text,
      timestamp: new Date(),
      isDirect: !isGroup,
      isMention: Boolean(p.isMention ?? !isGroup),
      isCommand: text.startsWith('/'),
      chatType: isGroup ? 'group' : 'private',
      chatTitle: isGroup ? from : undefined,
      senderName: String(p.senderName ?? ''),
      threadId: String(p.quotedId ?? p.threadId ?? (isGroup ? 'root' : 'dm')),
      raw,
    };
  }

  async sendMessage(conversationId: string, text: string, _options?: SendOptions): Promise<void> {
    if (!this.sock) return;
    for (const chunk of formatForChannel('whatsapp', text)) {
      await this.sock.sendMessage(conversationId, { text: chunk });
    }
  }

  formatForChannel(text: string): string[] {
    return formatForChannel('whatsapp', text);
  }
}

export function isBaileysConfigured(): boolean {
  return process.env.BAILEYS_WHATSAPP_ENABLED === 'true'
    || process.env.WHATSAPP_BAILEYS_ENABLED === 'true';
}

function groupsEnabled(): boolean {
  return process.env.CARINA_WHATSAPP_GROUPS === 'true';
}

function selfBridgeEnabled(): boolean {
  return process.env.CARINA_WHATSAPP_SELF_BRIDGE === 'true';
}

function extractText(content: Record<string, unknown> | undefined): string {
  if (!content) return '';
  return String(
    (content.conversation as string | undefined)
    ?? ((content.extendedTextMessage as Record<string, unknown> | undefined)?.text as string | undefined)
    ?? ((content.imageMessage as Record<string, unknown> | undefined)?.caption as string | undefined)
    ?? ((content.videoMessage as Record<string, unknown> | undefined)?.caption as string | undefined)
    ?? '',
  ).trim();
}

function isMentioned(content: Record<string, unknown> | undefined, myJid: string): boolean {
  const ext = content?.extendedTextMessage as Record<string, unknown> | undefined;
  const mentioned = (ext?.contextInfo as Record<string, unknown> | undefined)?.mentionedJid as string[] | undefined;
  if (mentioned?.some((j) => j === myJid)) return true;
  const text = extractText(content);
  return text.includes('@carina') || text.startsWith('/carina');
}

async function resolveSenderName(jid: string): Promise<string> {
  const phone = jid.split('@')[0] ?? jid;
  const matches = await findContact(phone);
  return matches[0]?.name ?? phone;
}

function normalizeWaJid(jid: string): string {
  return (jid.split(':')[0] ?? jid).trim();
}

async function handleInboundMessage(
  adapter: BaileysWhatsAppAdapter,
  msg: Record<string, unknown>,
  baileys: BaileysModule,
  myJid: string,
): Promise<void> {
  const key = msg.key as Record<string, unknown> | undefined;
  const from = String(key?.remoteJid ?? '');
  const fromMe = Boolean(key?.fromMe);
  if (fromMe) {
    if (!selfBridgeEnabled()) return;
    if (normalizeWaJid(from) !== normalizeWaJid(myJid)) return;
  }

  const content = msg.message as Record<string, unknown> | undefined;
  const isGroup = from.endsWith('@g.us');

  if (isGroup && !groupsEnabled()) return;
  if (isGroup && !isMentioned(content, myJid)) return;

  let text = extractText(content);
  const mediaPaths: string[] = [];

  const hasMedia = content && (
    content.audioMessage || content.imageMessage || content.documentMessage || content.videoMessage
  );

  if (hasMedia) {
    const reupload = async (m: Record<string, unknown>) => m;
    const saved = await saveInboundMedia(baileys, msg, reupload);
    if (saved) {
      mediaPaths.push(saved.filePath);
      if (saved.kind === 'audio') {
        const transcript = await transcribeInboundAudio(saved.filePath);
        if (transcript) {
          text = transcript;
        } else {
          text = text || `[Voice message saved: ${saved.filePath}]`;
        }
      } else if (!text) {
        text = `[${saved.kind} received: ${saved.filePath}]`;
      }
    }
  }

  if (!text) return;

  const senderName = await resolveSenderName(
    String((key?.participant as string | undefined) ?? from),
  );
  const prompt = isGroup
    ? `[WhatsApp group ${from}, sender: ${senderName}]\n${text}`
    : `[WhatsApp from ${senderName}]\n${text}`;

  const router = getRouter();
  const chunks: string[] = [];
  for await (const chunk of router.handleInbound('whatsapp', {
    text: prompt,
    from,
    remoteJid: from,
    participant: String((key?.participant as string | undefined) ?? from),
    id: key?.id,
    senderName,
    isGroup,
    quotedId: ((content?.extendedTextMessage as Record<string, unknown> | undefined)?.contextInfo as Record<string, unknown> | undefined)?.stanzaId,
    isMention: isGroup ? isMentioned(content, myJid) : true,
  })) {
    chunks.push(chunk);
  }
  const reply = chunks.join('');
  if (reply) await adapter.sendMessage(from, reply);
}

function resolveWhatsAppSessionDir(accountId: string): string {
  if (process.env.BAILEYS_AUTH_DIR?.trim()) {
    return process.env.BAILEYS_AUTH_DIR.trim();
  }
  return path.join(resolveCarinaDataDir(), 'whatsapp', accountId, 'session');
}

function resolveWhatsAppAccountId(): string {
  return process.env.CARINA_WHATSAPP_ACCOUNT_ID?.trim() || 'default';
}

async function reportWhatsAppSessionRevoked(accountId: string, reason: number | undefined): Promise<void> {
  await reportEvent({
    severity: 'critical',
    source: 'carina-whatsapp',
    event_type: 'whatsapp_session_revoked',
    description: 'WhatsApp session was revoked from the linked device',
    metadata: { accountId, reason },
    instance_id: process.env.CARINA_INSTANCE_ID ?? 'carina-core',
  }).catch(() => undefined);
}

async function connectBaileys(
  baileys: BaileysModule,
  sessionDir: string,
  accountId: string,
  sessionSecret: string,
  options: {
    printQRInTerminal?: boolean;
    reconnect?: boolean;
    onUpdate?: (update: BaileysPairingUpdate) => void | Promise<void>;
  } = {},
): Promise<BaileysSocket> {
  const existing = baileysSockets.get(accountId);
  if (existing) {
    try { existing.end(); } catch { /* ignore */ }
    baileysSockets.delete(accountId);
  }

  const adapter = new BaileysWhatsAppAdapter(true, accountId);
  channelRegistry.register(adapter);

  const { state, saveCreds } = await useEncryptedAuthState(sessionDir, sessionSecret);
  const { version } = await baileys.fetchLatestBaileysVersion();

  const sock = baileys.default({
    version,
    auth: {
      creds: (state as { creds: unknown }).creds,
      keys: baileys.makeCacheableSignalKeyStore((state as { keys: unknown }).keys, undefined),
    },
    printQRInTerminal: options.printQRInTerminal ?? process.env.BAILEYS_QR_TERMINAL !== 'false',
    syncFullHistory: false,
    markOnlineOnConnect: true,
  });

  baileysSockets.set(accountId, sock);
  const myJid = String((state as { creds?: { me?: { id?: string } } }).creds?.me?.id ?? '');

  sock.ev.on('creds.update', () => void saveCreds());

  sock.ev.on('connection.update', async (update: unknown) => {
    const u = update as {
      connection?: string;
      lastDisconnect?: { error?: { output?: { statusCode?: number } } };
      qr?: string;
    };

    if (u.qr) {
      const qrPath = path.join(sessionDir, '..', 'baileys-qr.txt');
      await fs.writeFile(qrPath, u.qr, 'utf8').catch(() => undefined);
      console.log(chalk.gray(`QR saved to ${qrPath}`));
      await options.onUpdate?.({ accountId, qr: u.qr, connection: u.connection, statusCode: undefined });
    }

    if (u.connection === 'close') {
      const status = u.lastDisconnect?.error?.output?.statusCode;
      await options.onUpdate?.({ accountId, connection: 'close', statusCode: status });
      const loggedOut = status === baileys.DisconnectReason.loggedOut;
      if (loggedOut) {
        console.warn(chalk.yellow('WhatsApp logged out. Run: carina whatsapp setup'));
        await reportWhatsAppSessionRevoked(accountId, status);
        try {
          await fs.unlink(path.join(sessionDir, 'creds.enc'));
        } catch { /* ignore */ }
        return;
      }
      if (options.reconnect === false) return;
      reconnectAttempts++;
      const delay = Math.min(reconnectAttempts * 2000, 30_000);
      console.warn(chalk.yellow(`WhatsApp disconnected. Reconnecting in ${delay / 1000}s...`));
      setTimeout(() => {
        void connectBaileys(baileys, sessionDir, accountId, sessionSecret).catch((err) => {
          console.warn(chalk.yellow(`WhatsApp reconnect failed: ${err instanceof Error ? err.message : err}`));
        });
      }, delay).unref();
    }

    if (u.connection === 'open') {
      reconnectAttempts = 0;
      console.log(chalk.green('Baileys WhatsApp connected'));
      await options.onUpdate?.({ accountId, connection: 'open' });
    }
  });

  sock.ev.on('messages.upsert', async (upsert: unknown) => {
    const payload = upsert as { messages?: Array<Record<string, unknown>> };
    for (const msg of payload.messages ?? []) {
      try {
        await handleInboundMessage(adapter, msg, baileys, myJid);
      } catch (err) {
        console.warn(chalk.yellow(`WhatsApp message error: ${err instanceof Error ? err.message : err}`));
      }
    }
  });

  return sock;
}

export async function startBaileysPairingSession(input: {
  accountId: string;
  onUpdate?: (update: BaileysPairingUpdate) => void | Promise<void>;
}): Promise<void> {
  let baileys: BaileysModule;
  try {
    baileys = await import('@whiskeysockets/baileys') as unknown as BaileysModule;
  } catch {
    throw new Error('Baileys package is not installed. Install @whiskeysockets/baileys.');
  }

  const sessionSecret = requireSessionSecret();
  const sessionDir = resolveWhatsAppSessionDir(input.accountId);
  await fs.mkdir(sessionDir, { recursive: true, mode: 0o700 });
  await connectBaileys(baileys, sessionDir, input.accountId, sessionSecret, {
    printQRInTerminal: false,
    reconnect: true,
    onUpdate: input.onUpdate,
  });
}

export async function startBaileysWhatsApp(): Promise<void> {
  if (!isBaileysConfigured()) {
    console.warn(chalk.yellow('Baileys WhatsApp skipped: set BAILEYS_WHATSAPP_ENABLED=true'));
    return;
  }

  let baileys: BaileysModule;
  try {
    baileys = await import('@whiskeysockets/baileys') as unknown as BaileysModule;
  } catch {
    console.warn(chalk.yellow('Baileys WhatsApp skipped: npm install @whiskeysockets/baileys'));
    return;
  }

  const sessionSecret = requireSessionSecret();
  const accountId = resolveWhatsAppAccountId();
  const sessionDir = resolveWhatsAppSessionDir(accountId);
  await fs.mkdir(sessionDir, { recursive: true, mode: 0o700 });

  await connectBaileys(baileys, sessionDir, accountId, sessionSecret);
  console.log(chalk.green('Baileys WhatsApp gateway ready (live session bridge)'));
}
