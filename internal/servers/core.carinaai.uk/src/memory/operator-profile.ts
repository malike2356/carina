import { addPersistentFact, getPersistentFactsText } from './persistent-memory.js';

let bootstrapPromise: Promise<void> | null = null;

export function getAgentName(): string {
  return (process.env.CARINA_AGENT_NAME ?? 'Carina').trim() || 'Carina';
}

export function getOperatorName(): string {
  return (process.env.CARINA_OPERATOR_NAME ?? '').trim();
}

async function doBootstrap(): Promise<void> {
  try {
    const existing = await getPersistentFactsText('user');
    if (existing.trim()) return;

    const name = getOperatorName();
    const context = (process.env.CARINA_OPERATOR_CONTEXT ?? '').trim();
    if (!name && !context) return;

    const parts: string[] = [];
    if (name) parts.push(`Operator name: ${name}`);
    if (context) parts.push(`Operator context: ${context}`);

    for (const part of parts) {
      await addPersistentFact('user', part).catch(() => null);
    }
  } catch {
    // Bootstrap failure must never break a session
  }
}

export function maybeBootstrapOperatorProfile(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = doBootstrap();
  }
  return bootstrapPromise;
}

export async function hasOperatorProfile(): Promise<boolean> {
  try {
    const text = await getPersistentFactsText('user');
    return text.trim().length > 0;
  } catch {
    return false;
  }
}
