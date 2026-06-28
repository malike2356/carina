import { pool } from '../../memory/db.js';
import type {
  ChannelContextFactRecord,
  ChannelFactType,
  ChannelMemoryQuery,
  ExtractedChannelFact,
} from './types.js';

const memoryStore = new Map<string, ChannelContextFactRecord>();

export function resetChannelMemoryStoreForTests(): void {
  memoryStore.clear();
}

export async function seedChannelFactForTests(input: {
  channelId: string;
  channelName: string;
  factType: ChannelContextFactRecord['factType'];
  summary: string;
  content?: string;
  extractedAt?: string;
  metadata?: Record<string, unknown>;
}): Promise<ChannelContextFactRecord> {
  const scope = `channel:${input.channelId}`;
  const extractedAt = input.extractedAt ?? new Date().toISOString();
  const record: ChannelContextFactRecord = {
    id: `test_${Date.now()}_${Math.random()}`,
    scope,
    scopeName: input.channelName,
    summary: input.summary,
    content: input.content ?? input.summary,
    factType: input.factType,
    confidence: 0.9,
    metadata: {
      factType: input.factType,
      extractedAt,
      staleAfter: input.metadata?.staleAfter ?? '7d',
      ...input.metadata,
    },
    extractedAt,
    createdAt: extractedAt,
  };
  memoryStore.set(record.id, record);
  return record;
}

function rowToRecord(row: Record<string, unknown>): ChannelContextFactRecord {
  return {
    id: String(row.id),
    scope: String(row.scope),
    scopeName: String(row.scope_name ?? ''),
    summary: String(row.summary),
    content: String(row.content),
    factType: String(row.fact_type) as ChannelFactType,
    confidence: Number(row.confidence),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    extractedAt: new Date(String(row.extracted_at)).toISOString(),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

function jaccardSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...wordsA].filter((w) => wordsB.has(w));
  const union = new Set([...wordsA, ...wordsB]);
  return union.size === 0 ? 0 : intersection.length / union.size;
}

export function isDuplicateFact(
  newFact: ExtractedChannelFact,
  existingFacts: ChannelContextFactRecord[],
): boolean {
  for (const existing of existingFacts) {
    const similarity = jaccardSimilarity(newFact.summary, existing.summary);
    if (similarity > 0.7 && existing.confidence > 0.5) return true;
  }
  return false;
}

export async function queryChannelFacts(
  opts: ChannelMemoryQuery,
): Promise<ChannelContextFactRecord[]> {
  if (!pool) {
    return queryInMemoryFacts(opts);
  }

  let sql = 'SELECT * FROM channel_context_facts WHERE 1=1';
  const params: unknown[] = [];

  if (opts.scope) {
    params.push(opts.scope);
    sql += ` AND scope = $${params.length}`;
  }
  if (opts.scopePrefix) {
    params.push(`${opts.scopePrefix}%`);
    sql += ` AND scope LIKE $${params.length}`;
  }
  if (opts.scopeNot) {
    params.push(opts.scopeNot);
    sql += ` AND scope != $${params.length}`;
  }
  if (opts.factType) {
    params.push(opts.factType);
    sql += ` AND fact_type = $${params.length}`;
  }
  if (opts.search) {
    params.push(`%${opts.search}%`);
    sql += ` AND (content ILIKE $${params.length} OR summary ILIKE $${params.length})`;
  }

  const orderCol = opts.orderBy === 'created_at' ? 'created_at' : 'extracted_at';
  const orderDir = opts.order === 'ASC' ? 'ASC' : 'DESC';
  sql += ` ORDER BY ${orderCol} ${orderDir}`;

  if (opts.limit) {
    params.push(opts.limit);
    sql += ` LIMIT $${params.length}`;
  }

  try {
    const result = await pool.query(sql, params);
    const dbRows = result.rows.map(rowToRecord);
    const memoryRows = queryInMemoryFacts(opts);
    const merged = [...dbRows];
    for (const row of memoryRows) {
      if (!merged.some((existing) => existing.id === row.id)) merged.push(row);
    }
    return merged;
  } catch {
    return queryInMemoryFacts(opts);
  }
}

function queryInMemoryFacts(opts: ChannelMemoryQuery): ChannelContextFactRecord[] {
  let rows = [...memoryStore.values()];
  if (opts.scope) rows = rows.filter((r) => r.scope === opts.scope);
  if (opts.scopePrefix) rows = rows.filter((r) => r.scope.startsWith(opts.scopePrefix!));
  if (opts.scopeNot) rows = rows.filter((r) => r.scope !== opts.scopeNot);
  if (opts.factType) rows = rows.filter((r) => r.factType === opts.factType);
  if (opts.search) {
    const needle = opts.search.toLowerCase();
    rows = rows.filter((r) =>
      r.summary.toLowerCase().includes(needle) || r.content.toLowerCase().includes(needle));
  }
  const orderCol = opts.orderBy === 'created_at' ? 'createdAt' : 'extractedAt';
  rows.sort((a, b) => {
    const cmp = a[orderCol].localeCompare(b[orderCol]);
    return opts.order === 'ASC' ? cmp : -cmp;
  });
  if (opts.limit) rows = rows.slice(0, opts.limit);
  return rows;
}

export async function persistChannelFacts(
  channelId: string,
  channelName: string,
  facts: ExtractedChannelFact[],
): Promise<number> {
  const scope = `channel:${channelId}`;
  const existing = await queryChannelFacts({ scope, limit: 200 });
  let saved = 0;

  for (const fact of facts) {
    if (fact.confidence < 0.5) continue;
    if (isDuplicateFact(fact, existing)) continue;

    const metadata = {
      factType: fact.type,
      confidence: fact.confidence,
      entities: fact.entities,
      sourceMessages: fact.sourceMessages,
      extractedAt: new Date().toISOString(),
      staleAfter: fact.staleAfter ?? '7d',
      channelName,
    };

    if (!pool) {
      const id = `mem_${Date.now()}_${saved}`;
      const record: ChannelContextFactRecord = {
        id,
        scope,
        scopeName: channelName,
        summary: fact.summary,
        content: fact.detail,
        factType: fact.type,
        confidence: fact.confidence,
        metadata,
        extractedAt: metadata.extractedAt,
        createdAt: metadata.extractedAt,
      };
      memoryStore.set(id, record);
      existing.push(record);
      saved += 1;
      continue;
    }

    try {
      await pool.query(
        `INSERT INTO channel_context_facts
          (scope, scope_name, summary, content, fact_type, confidence, metadata, extracted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())`,
        [scope, channelName, fact.summary, fact.detail, fact.type, fact.confidence, JSON.stringify(metadata)],
      );
      saved += 1;
    } catch {
      // fall back to in-memory when table unavailable
      const id = `mem_${Date.now()}_${saved}`;
      memoryStore.set(id, {
        id,
        scope,
        scopeName: channelName,
        summary: fact.summary,
        content: fact.detail,
        factType: fact.type,
        confidence: fact.confidence,
        metadata,
        extractedAt: metadata.extractedAt,
        createdAt: metadata.extractedAt,
      });
      saved += 1;
    }
  }

  return saved;
}

export async function purgeChannelMemory(channelId: string): Promise<number> {
  const scope = `channel:${channelId}`;
  if (!pool) {
    let removed = 0;
    for (const [id, row] of memoryStore) {
      if (row.scope === scope) {
        memoryStore.delete(id);
        removed += 1;
      }
    }
    return removed;
  }
  try {
    const result = await pool.query('DELETE FROM channel_context_facts WHERE scope = $1', [scope]);
    return result.rowCount ?? 0;
  } catch {
    return 0;
  }
}

export async function listAmbientChannels(): Promise<Array<{ id: string; name: string }>> {
  const rows = await queryChannelFacts({ scopePrefix: 'channel:', limit: 500 });
  const channels = new Map<string, string>();
  for (const row of rows) {
    const id = row.scope.replace(/^channel:/, '');
    channels.set(id, row.scopeName || id);
  }
  return [...channels.entries()].map(([id, name]) => ({ id, name }));
}
