import chalk from 'chalk';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { channelRegistry } from '../channels/channel-registry.js';
import { getRouter } from '../router.js';
import type { ChannelMessage, IChannelAdapter, SendOptions } from '../channels/channel-adapter.interface.js';
import { formatForChannel } from '../channels/channel-formatter.js';

type BaileysModule = {
  default: (opts: Record<string, unknown>) => {
    ev: { on: (event: string, handler: (...args: unknown[]) => void) => void };
    sendMessage: (jid: string, content: { text: string }) => Promise<unknown>;
    logout: () => Promise<void>;
  };
  useMultiFileAuthState: (dir: string) => Promise<{ state: unknown; saveCreds: () => Promise<void> }>;
  fetchLatestBaileysVersion: () => Promise<{ version: number[] }>;
  makeCacheableSignalKeyStore: (state: unknown, logger: unknown) => unknown;
  DisconnectReason: { loggedOut: number };
};

const baileysSockets = new Map<string, ReturnType<BaileysModule['default']>>();

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
    return {
      id: String(p.id ?? Date.now()),
      channel: 'whatsapp',
      externalUserId: from,
      conversationId: from,
      text,
      timestamp: new Date(),
      isDirect: true,
      isMention: true,
      isCommand: text.startsWith('/'),
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

  const authDir = process.env.BAILEYS_AUTH_DIR
    ?? path.join(process.env.CARINA_HOME ?? path.join(os.homedir(), '.carina'), 'baileys-auth');
  await fs.mkdir(authDir, { recursive: true });

  const adapter = new BaileysWhatsAppAdapter(true);
  channelRegistry.register(adapter);

  const { state, saveCreds } = await baileys.useMultiFileAuthState(authDir);
  const { version } = await baileys.fetchLatestBaileysVersion();

  const sock = baileys.default({
    version,
    auth: {
      creds: (state as { creds: unknown }).creds,
      keys: baileys.makeCacheableSignalKeyStore((state as { keys: unknown }).keys, undefined),
    },
    printQRInTerminal: process.env.BAILEYS_QR_TERMINAL !== 'false',
    syncFullHistory: false,
  });

  baileysSockets.set('default', sock);
  sock.ev.on('creds.update', () => void saveCreds());

  sock.ev.on('messages.upsert', async (upsert: unknown) => {
    const payload = upsert as { messages?: Array<Record<string, unknown>> };
    const msg = payload.messages?.[0];
    if (!msg) return;

    const key = msg.key as Record<string, unknown> | undefined;
    if (key?.fromMe) return;

    const content = msg.message as Record<string, unknown> | undefined;
    const text = String(
      (content?.conversation as string | undefined)
      ?? ((content?.extendedTextMessage as Record<string, unknown> | undefined)?.text as string | undefined)
      ?? '',
    ).trim();
    if (!text) return;

    const from = String(key?.remoteJid ?? '');
    const inbound = adapter.parseInbound({ text, from, id: key?.id });
    if (!inbound) return;

    const router = getRouter();
    const chunks: string[] = [];
    for await (const chunk of router.handleInbound('whatsapp', {
      text,
      from,
      remoteJid: from,
      id: key?.id,
    })) {
      chunks.push(chunk);
    }
    const reply = chunks.join('');
    if (reply) await adapter.sendMessage(from, reply);
  });

  console.log(chalk.green('Baileys WhatsApp gateway ready (live session bridge)'));
}
