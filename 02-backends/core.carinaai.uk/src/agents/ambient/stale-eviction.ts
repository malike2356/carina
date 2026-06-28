import { queryChannelFacts } from './channel-memory-store.js';

const STALENESS_MS: Record<string, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  manual: Infinity,
};

export async function evictStaleChannelFacts(): Promise<number> {
  const rows = await queryChannelFacts({ scopePrefix: 'channel:', limit: 1000, order: 'ASC' });
  const now = Date.now();
  let evicted = 0;

  for (const fact of rows) {
    const staleAfter = String(fact.metadata.staleAfter ?? '7d');
    const maxAge = STALENESS_MS[staleAfter] ?? STALENESS_MS['7d'];
    const extractedAt = new Date(String(fact.metadata.extractedAt ?? fact.extractedAt)).getTime();
    if (Number.isFinite(maxAge) && now - extractedAt > maxAge) {
      const { pool } = await import('../../memory/db.js');
      if (pool) {
        try {
          await pool.query('DELETE FROM channel_context_facts WHERE id = $1', [fact.id]);
          evicted += 1;
        } catch {
          // ignore delete failures in eviction pass
        }
      }
    }
  }

  return evicted;
}

export function createAmbientEvictionTask() {
  return {
    name: 'ambient-channel-fact-eviction',
    intervalMinutes: 60,
    run: async () => {
      await evictStaleChannelFacts();
    },
  };
}
