import { paddleClient } from './paddle-client.js';
import { resolveConfigValue } from '../billing-config.js';

export async function createPaddleCheckoutSession(params: {
  workspaceId: string;
  interval: 'month' | 'year';
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
}): Promise<{ checkoutUrl: string }> {
  const priceEnvKey = params.interval === 'year'
    ? 'PADDLE_PRICE_AIVA_BUSINESS_ANNUAL'
    : 'PADDLE_PRICE_AIVA_BUSINESS_MONTHLY';
  const priceId = resolveConfigValue(priceEnvKey);
  if (!priceId) throw new Error(`Paddle price not configured: ${priceEnvKey}`);

  const paddle = paddleClient();
  const transaction = await paddle.transactions.create({
    items: [{ priceId, quantity: 1 }],
    customData: { workspaceId: params.workspaceId },
    checkout: {
      url: params.successUrl,
    },
  });

  if (!transaction.checkout?.url) {
    throw new Error('Paddle did not return a checkout URL');
  }

  return { checkoutUrl: transaction.checkout.url };
}
