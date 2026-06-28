import type { AmbientChannelMessage } from './types.js';
import { extractChannelFacts } from './fact-extractor.js';
import { persistChannelFacts } from './channel-memory-store.js';

export async function processChannelBatch(
  channelId: string,
  channelName: string,
  messages: AmbientChannelMessage[],
): Promise<number> {
  const facts = await extractChannelFacts(channelId, channelName, messages);
  if (facts.length === 0) return 0;
  return persistChannelFacts(channelId, channelName, facts);
}
