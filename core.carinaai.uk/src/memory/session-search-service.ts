import pgvector from 'pgvector/pg';
import { pool } from './db.js';
import { embed } from './embeddings.js';
import {
  combineMatchScore,
  computeRecencyBoost,
  escapeIlikePattern,
  mergeBestPerLineageRoot,
  mergeBestPerSession,
  pickPrimaryStrategy,
  sortSessionMatches,
  type RawSessionMatch,
  type SessionMatchStrategy,
  type SessionSearchSort,
} from './session-search-ranking.js';
import { operatorMemoryScope } from '../profiles/isolation.js';
import { getLineageRoot } from './session-lineage.js';
import { generateSessionTitle } from './session-titles.js';

async function searchFts5Sessions(
  query: string,
  limit: number,
  offset: number,
): Promise<SessionSearchResponse | null> {
  try {
    const { isSessionFtsAvailable, currentProfileId } = await import('./session-fts-db.js');
    if (!isSessionFtsAvailable()) return null;

    const { searchSessionsFts5 } = await import('./session-fts-search.js');
    const hits = searchSessionsFts5(query, {
      profileId: currentProfileId(),
      limit: limit + offset,
    });

    const mapped: SessionSearchHitResult[] = hits.map((hit) => ({
      sessionId: hit.sessionId,
      messageId: `${hit.sessionId}:fts5`,
      title: hit.title,
      timestamp: new Date(hit.createdAt),
      snippet: hit.snippet,
      bookendStart: [],
      bookendEnd: [],
      contextWindow: [],
      rank: Math.abs(hit.rank),
      matchStrategy: 'fts',
      lineageRoot: getLineageRoot(hit.sessionId),
    }));

    const pageRows = mapped.slice(offset, offset + limit);
    let summary: string | undefined;
    if (pageRows.length > 0) {
      try {
        const { summarizeSessionSearchResults } = await import('./session-search-summary.js');
        summary = await summarizeSessionSearchResults(query, pageRows.map((r) => ({
          sessionId: r.sessionId,
          snippet: r.snippet,
        })));
      } catch {
        summary = undefined;
      }
    }

    return {
      results: pageRows,
      total: mapped.length,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      totalPages: mapped.length > 0 ? Math.ceil(mapped.length / limit) : 0,
      query,
      sort: 'relevance',
      strategy: 'fts',
      fallbackUsed: false,
      indexHealthy: true,
      summary,
    };
  } catch (err) {
    console.error('[session-search] FTS5 lookup skipped:', err);
    return null;
  }
}

export interface SessionMessage {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  createdAt: Date;
}

export interface SessionSearchHit {
  sessionId: string;
  title: string;
  timestamp: Date;
  snippet: string;
  bookendStart: string[];
  bookendEnd: string[];
  contextWindow: string[];
}

export interface TenantScope {
  sql: string;
  params: unknown[];
}

export interface SessionSearchOptions {
  query: string;
  limit?: number;
  offset?: number;
  roleFilter?: string;
  sort?: SessionSearchSort;
  tenantScope?: TenantScope;
  enableSemantic?: boolean;
}

export interface SessionSearchHitResult extends SessionSearchHit {
  messageId: string;
  rank: number;
  matchStrategy: SessionMatchStrategy;
  lineageRoot?: string;
}

export interface SessionSearchResponse {
  results: SessionSearchHitResult[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  query: string;
  sort: SessionSearchSort;
  strategy: SessionMatchStrategy | 'mixed';
  fallbackUsed: boolean;
  indexHealthy: boolean;
  summary?: string;
}

let indexHealthCache: { at: number; healthy: boolean; trgm: boolean } | null = null;
const INDEX_CACHE_MS = 60_000;

export function clearSessionSearchCacheForTests(): void {
  indexHealthCache = null;
}

async function getIndexHealth(): Promise<{ fts: boolean; trgm: boolean }> {
  const now = Date.now();
  if (indexHealthCache && now - indexHealthCache.at < INDEX_CACHE_MS) {
    return { fts: indexHealthCache.healthy, trgm: indexHealthCache.trgm };
  }
  let fts = false;
  let trgm = false;
  try {
    const idx = await pool.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes
       WHERE tablename = 'episodic_memories'
         AND indexname IN ('episodic_memories_tsv_idx', 'episodic_memories_content_trgm_idx')`,
    );
    fts = idx.rows.some((r) => r.indexname === 'episodic_memories_tsv_idx');
    trgm = idx.rows.some((r) => r.indexname === 'episodic_memories_content_trgm_idx');
  } catch {
    fts = false;
    trgm = false;
  }
  indexHealthCache = { at: now, healthy: fts, trgm };
  return { fts, trgm };
}

async function queryFtsMatches(
  query: string,
  scope?: TenantScope,
  roleFilter?: string,
): Promise<RawSessionMatch[]> {
  const clause = scope?.sql ?? 'TRUE';
  const qParams: unknown[] = [...(scope?.params ?? [])];
  const qRef = `$${qParams.push(query)}`;
  const roleClause = roleFilter ? `AND role = $${qParams.push(roleFilter)}` : '';

  const result = await pool.query(
    `SELECT id AS message_id, session_id, role, content, created_at,
            ts_headline('english', content, websearch_to_tsquery('english', ${qRef})) AS snippet,
            ts_rank_cd(content_tsv, websearch_to_tsquery('english', ${qRef}), 32) AS fts_rank
     FROM episodic_memories
     WHERE ${clause}
       AND content_tsv @@ websearch_to_tsquery('english', ${qRef})
       ${roleClause}`,
    qParams,
  );

  return result.rows.map((row) => mapRow(row, 'fts', Number(row.fts_rank ?? 0), 0, 0, 0));
}

async function queryHybridMatches(
  query: string,
  scope?: TenantScope,
  roleFilter?: string,
  useTrgm = false,
): Promise<RawSessionMatch[]> {
  const clause = scope?.sql ?? 'TRUE';
  const qParams: unknown[] = [...(scope?.params ?? [])];
  const qRef = `$${qParams.push(query)}`;
  const patternRef = `$${qParams.push(`%${escapeIlikePattern(query)}%`)}`;
  const prefixRef = `$${qParams.push(`${escapeIlikePattern(query)}%`)}`;
  const roleClause = roleFilter ? `AND role = $${qParams.push(roleFilter)}` : '';

  const fuzzyExpr = useTrgm && query.length >= 3
    ? `GREATEST(similarity(content, ${qRef}), 0)`
    : '0::float';

  const result = await pool.query(
    `SELECT id AS message_id, session_id, role, content, created_at,
            LEFT(content, 300) AS snippet,
            0::float AS fts_rank,
            CASE
              WHEN content ILIKE ${prefixRef} ESCAPE '\\' THEN 0.45
              WHEN content ILIKE ${patternRef} ESCAPE '\\' THEN 0.2
              ELSE 0
            END AS prefix_rank,
            ${fuzzyExpr} AS fuzzy_rank
     FROM episodic_memories
     WHERE ${clause}
       ${roleClause}
       AND (
         content ILIKE ${patternRef} ESCAPE '\\'
         ${useTrgm && query.length >= 3 ? `OR similarity(content, ${qRef}) > 0.12` : ''}
       )`,
    qParams,
  );

  return result.rows.map((row) => {
    const prefixRank = Number(row.prefix_rank ?? 0);
    const fuzzyRank = Number(row.fuzzy_rank ?? 0);
    const strategy: SessionMatchStrategy = fuzzyRank > prefixRank ? 'fuzzy' : 'prefix';
    return mapRow(row, strategy, 0, prefixRank, fuzzyRank, 0);
  });
}

async function querySemanticMatches(
  query: string,
  scope?: TenantScope,
  roleFilter?: string,
): Promise<RawSessionMatch[]> {
  const embedding = await embed(query);
  if (embedding.length === 0) return [];

  const clause = scope?.sql ?? 'TRUE';
  const qParams: unknown[] = [...(scope?.params ?? [])];
  const vectorSql = pgvector.toSql(embedding);
  const vectorRef = `$${qParams.push(vectorSql)}`;
  const roleClause = roleFilter ? `AND role = $${qParams.push(roleFilter)}` : '';

  const result = await pool.query(
    `SELECT id AS message_id, session_id, role, content, created_at,
            LEFT(content, 300) AS snippet,
            GREATEST(0, 1 - (embedding <=> ${vectorRef}::vector)) AS semantic_rank
     FROM episodic_memories
     WHERE ${clause}
       ${roleClause}
       AND embedding IS NOT NULL
     ORDER BY embedding <=> ${vectorRef}::vector
     LIMIT 80`,
    qParams,
  );

  return result.rows
    .map((row) => mapRow(row, 'semantic', 0, 0, 0, Number(row.semantic_rank ?? 0)))
    .filter((row) => row.semanticRank >= 0.35);
}

function mapRow(
  row: Record<string, unknown>,
  strategy: SessionMatchStrategy,
  ftsRank: number,
  prefixRank: number,
  fuzzyRank: number,
  semanticRank: number,
): RawSessionMatch {
  return {
    sessionId: String(row.session_id),
    messageId: String(row.message_id),
    role: String(row.role),
    content: String(row.content),
    createdAt: new Date(String(row.created_at)),
    snippet: String(row.snippet ?? row.content).slice(0, 300),
    ftsRank,
    prefixRank,
    fuzzyRank,
    semanticRank,
    matchStrategy: strategy,
  };
}

async function enrichHits(matches: RawSessionMatch[]): Promise<SessionSearchHitResult[]> {
  const hits: SessionSearchHitResult[] = [];
  for (const match of matches) {
    const [bookendStart, bookendEnd, contextWindow, title] = await Promise.all([
      fetchBookend(match.sessionId, 'start'),
      fetchBookend(match.sessionId, 'end'),
      fetchContextWindow(match.sessionId, match.messageId, 5),
      deriveSessionTitle(match.sessionId),
    ]);
    const recency = computeRecencyBoost(match.createdAt);
    hits.push({
      sessionId: match.sessionId,
      messageId: match.messageId,
      title,
      timestamp: match.createdAt,
      snippet: match.snippet,
      bookendStart,
      bookendEnd,
      contextWindow,
      rank: combineMatchScore(match, recency),
      matchStrategy: pickPrimaryStrategy(match),
      lineageRoot: getLineageRoot(match.sessionId),
    });
  }
  return hits;
}

export async function searchSessionsAdvanced(
  options: SessionSearchOptions,
): Promise<SessionSearchResponse> {
  const query = options.query.trim();
  const limit = Math.min(Math.max(options.limit ?? 10, 1), 50);
  const offset = Math.max(options.offset ?? 0, 0);
  const sort = options.sort ?? 'relevance';
  const empty: SessionSearchResponse = {
    results: [],
    total: 0,
    page: Math.floor(offset / limit) + 1,
    pageSize: limit,
    totalPages: 0,
    query,
    sort,
    strategy: 'fts',
    fallbackUsed: false,
    indexHealthy: false,
  };
  if (!query) return empty;

  const fts5Response = await searchFts5Sessions(query, limit, offset);
  if (fts5Response && fts5Response.results.length > 0) return fts5Response;

  const health = await getIndexHealth();
  let fallbackUsed = false;
  let rows: RawSessionMatch[] = [];

  try {
    if (health.fts) rows = await queryFtsMatches(query, options.tenantScope, options.roleFilter);
  } catch (err) {
    console.error('[session-search] FTS failed:', err);
    fallbackUsed = true;
  }

  if (rows.length === 0) {
    try {
      rows = await queryHybridMatches(query, options.tenantScope, options.roleFilter, health.trgm);
      fallbackUsed = true;
    } catch (err) {
      console.error('[session-search] hybrid fallback failed:', err);
      return { ...empty, fallbackUsed: true, indexHealthy: health.fts };
    }
  }

  if (options.enableSemantic !== false) {
    try {
      const semantic = await querySemanticMatches(query, options.tenantScope, options.roleFilter);
      rows = mergeBestPerSession([...rows, ...semantic]);
    } catch (err) {
      console.error('[session-search] semantic blend skipped:', err);
    }
  } else {
    rows = mergeBestPerSession(rows);
  }

  rows = mergeBestPerLineageRoot(rows, getLineageRoot);

  rows = sortSessionMatches(rows, sort);
  const total = rows.length;
  const pageRows = rows.slice(offset, offset + limit);
  const results = await enrichHits(pageRows);

  const strategies = new Set(results.map((r) => r.matchStrategy));
  const strategy = strategies.size === 1 ? results[0]!.matchStrategy : 'mixed';

  let summary: string | undefined;
  if (results.length > 0) {
    try {
      const { summarizeSessionSearchResults } = await import('./session-search-summary.js');
      summary = await summarizeSessionSearchResults(query, results.map((r) => ({
        sessionId: r.sessionId,
        snippet: r.snippet,
      })));
    } catch {
      summary = undefined;
    }
  }

  return {
    results,
    total,
    page: Math.floor(offset / limit) + 1,
    pageSize: limit,
    totalPages: total > 0 ? Math.ceil(total / limit) : 0,
    query,
    sort,
    strategy,
    fallbackUsed,
    indexHealthy: health.fts,
    summary,
  };
}

async function fetchBookend(sessionId: string, which: 'start' | 'end'): Promise<string[]> {
  const order = which === 'start' ? 'ASC' : 'DESC';
  const result = await pool.query(
    `SELECT role, content FROM episodic_memories
     WHERE session_id = $1
     ORDER BY created_at ${order}
     LIMIT 3`,
    [sessionId],
  );
  const lines = result.rows.map((r) => `${r.role}: ${r.content}`);
  return which === 'end' ? lines.reverse() : lines;
}

async function fetchContextWindow(
  sessionId: string,
  messageId: string,
  window: number,
): Promise<string[]> {
  const messages = await getSessionWindowInternal(sessionId, messageId, window);
  return messages.map((m) => `${m.role}: ${m.content}`);
}

async function deriveSessionTitle(sessionId: string): Promise<string> {
  const result = await pool.query(
    `SELECT content FROM episodic_memories
     WHERE session_id = $1 AND role = 'user'
     ORDER BY created_at ASC LIMIT 1`,
    [sessionId],
  );
  const first = String(result.rows[0]?.content ?? sessionId);
  if (!result.rows[0]?.content) return sessionId;
  return generateSessionTitle(first);
}

export async function getSessionWindowInternal(
  sessionId: string,
  aroundMessageId: string,
  window = 5,
): Promise<SessionMessage[]> {
  const { getSessionMessageWindow } = await import('./session-scroll.js');
  return getSessionMessageWindow(sessionId, aroundMessageId, window);
}

export function tenantScopeFromId(tenantId: string): TenantScope {
  if (tenantId === '__operator__') {
    return operatorMemoryScope();
  }
  if (tenantId === 'default') {
    return operatorMemoryScope('default');
  }
  return { sql: 'session_id LIKE $1', params: [`${tenantId}:%`] };
}
