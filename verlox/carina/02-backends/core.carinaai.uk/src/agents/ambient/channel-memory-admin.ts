import type { ChannelContextFactRecord } from './types.js';
import {
  purgeChannelMemory,
  queryChannelFacts,
} from './channel-memory-store.js';

export async function getChannelMemoryGrouped(channelId: string): Promise<Record<string, ChannelContextFactRecord[]>> {
  const facts = await queryChannelFacts({
    scope: `channel:${channelId}`,
    orderBy: 'extracted_at',
    order: 'DESC',
    limit: 200,
  });
  const grouped: Record<string, ChannelContextFactRecord[]> = {};
  for (const fact of facts) {
    const bucket = grouped[fact.factType] ?? [];
    bucket.push(fact);
    grouped[fact.factType] = bucket;
  }
  return grouped;
}

export async function getChannelMemoryStats(): Promise<{
  channels: Array<{ channelId: string; channelName: string; factCount: number }>;
  totalFacts: number;
  byType: Record<string, number>;
  staleCount: number;
}> {
  const facts = await queryChannelFacts({ scopePrefix: 'channel:', limit: 5000 });
  const channels = new Map<string, { channelName: string; factCount: number }>();
  const byType: Record<string, number> = {};
  let staleCount = 0;
  const now = Date.now();

  for (const fact of facts) {
    const channelId = fact.scope.replace(/^channel:/, '');
    const existing = channels.get(channelId) ?? { channelName: fact.scopeName, factCount: 0 };
    existing.factCount += 1;
    channels.set(channelId, existing);
    byType[fact.factType] = (byType[fact.factType] ?? 0) + 1;

    const staleAfter = String(fact.metadata.staleAfter ?? '7d');
    const maxAge = staleAfter === 'manual'
      ? Infinity
      : staleAfter === '30d'
        ? 30 * 24 * 60 * 60 * 1000
        : staleAfter === '7d'
          ? 7 * 24 * 60 * 60 * 1000
          : 24 * 60 * 60 * 1000;
    const extractedAt = new Date(String(fact.metadata.extractedAt ?? fact.extractedAt)).getTime();
    if (Number.isFinite(maxAge) && now - extractedAt > maxAge) staleCount += 1;
  }

  return {
    channels: [...channels.entries()].map(([channelId, meta]) => ({
      channelId,
      channelName: meta.channelName,
      factCount: meta.factCount,
    })),
    totalFacts: facts.length,
    byType,
    staleCount,
  };
}

export { purgeChannelMemory };
