import { createRequire } from 'node:module';
import type { Paddle } from '@paddle/paddle-node-sdk';
import { resolveConfigValue } from '../billing-config.js';

type PaddleSdk = typeof import('@paddle/paddle-node-sdk');

const require = createRequire(import.meta.url);

let _client: Paddle | null = null;
let _sdk: PaddleSdk | null = null;

function paddleSdk(): PaddleSdk {
  if (_sdk) return _sdk;
  try {
    _sdk = require('@paddle/paddle-node-sdk') as PaddleSdk;
    return _sdk;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Paddle SDK is not installed. Run npm install or pnpm install before enabling Paddle billing. ${message}`);
  }
}

export function paddleClient(): Paddle {
  if (_client) return _client;
  const apiKey = resolveConfigValue('PADDLE_API_KEY');
  if (!apiKey) throw new Error('PADDLE_API_KEY is not configured');
  const { Environment, Paddle } = paddleSdk();
  const env = resolveConfigValue('PADDLE_ENVIRONMENT') === 'production'
    ? Environment.production
    : Environment.sandbox;
  _client = new Paddle(apiKey, { environment: env });
  return _client;
}

export function paddleWebhookSecret(): string {
  const secret = resolveConfigValue('PADDLE_WEBHOOK_SECRET');
  if (!secret) throw new Error('PADDLE_WEBHOOK_SECRET is not configured');
  return secret;
}

export function resetPaddleClient(): void {
  _client = null;
}

/** @deprecated use resetPaddleClient */
export function resetPaddleClientForTests(): void {
  resetPaddleClient();
}
