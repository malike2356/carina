import { Router, type Request, type Response } from 'express';
import chalk from 'chalk';
import { config } from '../config/index.js';
import { getRouter } from './router.js';
import { channelRegistry } from './channels/channel-registry.js';
import { SmsAdapter } from './channels/adapters/sms-adapter.js';

async function collectResponse(generator: AsyncGenerator<string>): Promise<string> {
  let full = '';
  for await (const chunk of generator) {
    full += chunk;
  }
  return full;
}

export function createSmsRouter(): Router {
  const router = Router();
  const adapter = new SmsAdapter(isSmsConfigured());
  channelRegistry.register(adapter);

  router.post('/sms', async (req: Request, res: Response) => {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const valid = await adapter.validateWebhook?.({
      headers: req.headers,
      body: req.body,
      url,
      method: req.method,
    });

    if (!valid) {
      res.status(403).send('Invalid signature');
      return;
    }

    const inbound = adapter.parseInbound(req.body);
    if (!inbound) {
      res.type('text/xml').send('<Response></Response>');
      return;
    }

    try {
      const reply = await collectResponse(getRouter().handleInbound('sms', req.body));
      await adapter.sendMessage(inbound.conversationId, reply || '(no response)');
      res.type('text/xml').send('<Response></Response>');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).send(msg);
    }
  });

  return router;
}

export function isSmsConfigured(): boolean {
  return Boolean(config.sms.accountSid && config.sms.authToken && config.sms.fromNumber);
}

export function logSmsStatus(): void {
  if (isSmsConfigured()) {
    console.log(chalk.gray('SMS gateway: POST /webhooks/sms'));
  } else {
    console.warn(
      chalk.yellow('SMS gateway skipped: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER'),
    );
  }
}
