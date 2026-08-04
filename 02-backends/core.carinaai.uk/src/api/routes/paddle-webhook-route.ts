import express, { type Express, type IRouter, type Request, type Response } from 'express';
import { paddleClient, paddleWebhookSecret } from '../../billing/paddle/paddle-client.js';
import { handlePaddleEvent } from '../../billing/paddle/paddle-webhook-handler.js';

const router: IRouter = express.Router();

router.post(
  '/api/billing/paddle/webhook',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const signature = req.headers['paddle-signature'];
    if (typeof signature !== 'string') {
      res.status(400).json({ error: 'Missing paddle-signature header' });
      return;
    }
    try {
      const paddle = paddleClient();
      const event = paddle.webhooks.unmarshal(
        req.body.toString(),
        paddleWebhookSecret(),
        signature,
      );
      if (!event) {
        res.status(400).json({ error: 'Invalid Paddle webhook payload' });
        return;
      }
      await handlePaddleEvent(event);
      res.json({ received: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Webhook error';
      res.status(400).json({ error: message });
    }
  },
);

export function mountPaddleWebhook(app: Express): void {
  app.use(router);
}

export default router;
