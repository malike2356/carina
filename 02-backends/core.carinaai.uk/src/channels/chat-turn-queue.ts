/**
 * Serialize inbound turns for one worker, channel, and external conversation.
 *
 * Telegram and other webhook providers may deliver a second update while the
 * first model turn is still running. Without serialization, the second reply
 * can reach the chat before the first reply and appear to answer the wrong
 * question. The key deliberately includes the worker so two Aiva bots can
 * never block or share one another's turns.
 */

const tails = new Map<string, Promise<void>>();

export function inboundTurnKey(input: {
  workerId: string;
  channel: string;
  conversationId: string;
}): string {
  return `${input.workerId}:${input.channel}:${input.conversationId}`;
}

export async function runInboundTurnSerialized<T>(
  key: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = tails.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.catch(() => undefined).then(() => current);
  tails.set(key, tail);

  await previous.catch(() => undefined);
  try {
    return await operation();
  } finally {
    release();
    if (tails.get(key) === tail) tails.delete(key);
  }
}

export function pendingInboundTurnCount(): number {
  return tails.size;
}

export function clearInboundTurnQueueForTests(): void {
  tails.clear();
}
