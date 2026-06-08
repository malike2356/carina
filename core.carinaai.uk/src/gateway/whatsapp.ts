import fs from 'fs/promises';
import path from 'path';
import { Router, type Request, type Response } from 'express';
import twilio from 'twilio';
import chalk from 'chalk';
import { config } from '../config/index.js';
import { getRouter } from './router.js';
import { channelRegistry } from './channels/channel-registry.js';
import { WhatsAppAdapter } from './channels/adapters/whatsapp-adapter.js';

const DATA_DIR = path.resolve('data');

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

export function createWhatsAppRouter(): Router {
  const router = Router();
  const adapter = new WhatsAppAdapter(isWhatsAppConfigured());
  channelRegistry.register(adapter);

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

    try {
      const reply = await collectResponse(getRouter().handleInbound('whatsapp', {
        ...req.body,
        __mediaPaths: mediaPaths,
      }));
      const client = twilio(config.twilio.accountSid, config.twilio.authToken);

      for (const chunk of adapter.formatForChannel(reply || '(no response)')) {
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
