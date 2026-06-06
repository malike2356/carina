import fs from 'fs/promises';
import path from 'path';
import { Router, type Request, type Response } from 'express';
import twilio from 'twilio';
import chalk from 'chalk';
import { config } from '../config/index.js';
import { getRouter } from './router.js';
import type { CarinaMessage } from '../types/index.js';

const WHATSAPP_MAX = 1600;
const DATA_DIR = path.resolve('data');

function splitMessage(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > 0) {
    chunks.push(rest.slice(0, maxLen));
    rest = rest.slice(maxLen);
  }
  return chunks;
}

async function collectResponse(generator: AsyncGenerator<string>): Promise<string> {
  let full = '';
  for await (const chunk of generator) {
    full += chunk;
  }
  return full;
}

async function saveMedia(
  url: string,
  contentType: string,
  accountSid: string,
  authToken: string,
): Promise<string | null> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const res = await fetch(url, {
      headers: {
        Authorization:
          'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      },
    });
    if (!res.ok) return null;

    const ext = contentType.includes('pdf')
      ? '.pdf'
      : contentType.includes('png')
        ? '.png'
        : contentType.includes('jpeg') || contentType.includes('jpg')
          ? '.jpg'
          : '.bin';

    const filename = `whatsapp-${Date.now()}${ext}`;
    const filePath = path.join(DATA_DIR, filename);
    const buffer = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(filePath, buffer);
    return filePath;
  } catch {
    return null;
  }
}

function buildUserMessage(body: string, mediaPaths: string[]): string {
  if (mediaPaths.length === 0) return body;
  const paths = mediaPaths.map((p) => `[attachment: ${p}]`).join('\n');
  return body ? `${body}\n\n${paths}` : paths;
}

export function createWhatsAppRouter(): Router {
  const router = Router();

  router.post('/whatsapp', async (req: Request, res: Response) => {
    const signature = req.headers['x-twilio-signature'] as string | undefined;
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

    const valid = twilio.validateRequest(
      config.twilio.authToken,
      signature ?? '',
      url,
      req.body as Record<string, string>,
    );

    if (!valid) {
      res.status(403).send('Invalid signature');
      return;
    }

    const from = String(req.body.From ?? '');
    const body = String(req.body.Body ?? '');
    const numMedia = parseInt(String(req.body.NumMedia ?? '0'), 10) || 0;

    const mediaPaths: string[] = [];
    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = String(req.body[`MediaUrl${i}`] ?? '');
      const mediaType = String(req.body[`MediaContentType${i}`] ?? '');
      if (mediaUrl) {
        const saved = await saveMedia(
          mediaUrl,
          mediaType,
          config.twilio.accountSid,
          config.twilio.authToken,
        );
        if (saved) mediaPaths.push(saved);
      }
    }

    const gateway = getRouter();
    const sessionId = await gateway.getSession('whatsapp', from);
    const userText = buildUserMessage(body, mediaPaths);

    const carinaMsg: CarinaMessage = {
      id: String(req.body.MessageSid ?? Date.now()),
      sessionId,
      content: userText,
      source: 'whatsapp',
      timestamp: new Date(),
    };

    try {
      const reply = await collectResponse(gateway.handle(carinaMsg));
      const client = twilio(config.twilio.accountSid, config.twilio.authToken);

      for (const chunk of splitMessage(reply || '(no response)', WHATSAPP_MAX)) {
        await client.messages.create({
          from: config.twilio.fromNumber,
          to: from,
          body: chunk,
        });
      }

      res.type('text/xml').send('<Response></Response>');
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      res.status(500).send(errMsg);
    }
  });

  return router;
}

export function isWhatsAppConfigured(): boolean {
  return Boolean(
    config.twilio.accountSid && config.twilio.authToken && config.twilio.fromNumber,
  );
}

export function logWhatsAppStatus(): void {
  if (isWhatsAppConfigured()) {
    console.log(chalk.gray('WhatsApp gateway: POST /webhooks/whatsapp'));
  } else {
    console.warn(
      chalk.yellow('WhatsApp gateway skipped: TWILIO_ACCOUNT_SID, AUTH_TOKEN, or FROM not set'),
    );
  }
}
