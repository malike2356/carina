import type { Worker } from '../types/index.js';
import { isPropreneurBridgeEnabled } from './aiva-feature-flags.js';
import { resolvePropreneurBinding } from './worker-bridge-store.js';
import {
  formatPortfolioContext,
  getEmailActivity,
  getPortfolio,
} from '../bridges/propreneur-bridge.js';
import { buildPropreneurCapabilitySystemNote } from '../tools/propreneur-channel-execution.js';

const cache = new Map<string, { text: string; expiresAt: number }>();
const TTL_MS = 5 * 60 * 1000;

export function buildPortfolioContextBlock(
  portfolioText: string,
  emailTotal: number,
): string {
  const lines = [
    portfolioText,
    emailTotal > 0
      ? `Email activity (24h): ${emailTotal} messages processed in Propreneur.`
      : '',
    'Use propreneur portfolio tools when the client asks about properties, compliance, deals, or email activity.',
  ].filter(Boolean);
  return `\n\n${lines.join('\n')}`;
}

export async function buildPortfolioContextSuffix(worker: Worker): Promise<string> {
  if (!isPropreneurBridgeEnabled()) return '';

  const binding = resolvePropreneurBinding(worker);
  if (!binding) {
    return '\n\nThis worker is not yet connected to a Propreneur workspace. ' +
      'If the user mentions properties, tenants, rent, maintenance, or Propreneur, ' +
      'offer to connect using the propreneur-connect tool. ' +
      'Say something like: "I can connect to your Propreneur workspace so I can help manage your properties. ' +
      'Would you like to set that up? It only takes a minute."';
  }

  const cached = cache.get(worker.id);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.text;
  }

  try {
    const [portfolio, emailActivity] = await Promise.all([
      getPortfolio(binding),
      getEmailActivity(binding, 24),
    ]);
    const emailTotal = Number((emailActivity as { total?: number }).total ?? 0);
    const text =
      buildPortfolioContextBlock(formatPortfolioContext(portfolio), emailTotal) +
      buildPropreneurCapabilitySystemNote();
    cache.set(worker.id, { text, expiresAt: Date.now() + TTL_MS });
    return text;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[portfolio-context] unavailable for worker ${worker.id}: ${message}`);
    return '';
  }
}

export function clearPortfolioContextCache(workerId?: string): void {
  if (workerId) cache.delete(workerId);
  else cache.clear();
}
