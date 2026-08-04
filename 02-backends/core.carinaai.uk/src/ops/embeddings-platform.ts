import pgvector from 'pgvector/pg';
import { pool } from '../memory/db.js';
import {
  DIMENSIONS,
  embed,
  embeddingProviderStatus,
  type EmbeddingProviderStatus,
} from '../memory/embeddings.js';
import {
  PROVIDER_MAP,
  isEmbeddingProviderConfigured,
  listEmbeddingProviders,
  providerApiKey,
  providerBaseUrl,
  providerModel,
  type ProviderDefinition,
} from '../brain/provider-registry.js';
import { writeSetting, readDomainSettings } from '../config/settings-store.js';
import { config } from '../config/index.js';

export const EMBEDDINGS_DOMAIN = 'embeddings:platform';

/** Keys managed by the Ops Embeddings UI; DB wins when a row exists. */
export const EMBEDDINGS_MANAGED_KEYS = [
  'CARINA_EMBEDDING_PROVIDER',
  'CARINA_EMBEDDING_MODEL',
  'CARINA_EMBEDDING_MAX_CHARS',
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'VOYAGE_API_KEY',
  'OLLAMA_BASE_URL',
  'OLLAMA_API_KEY',
  'OLLAMA_ENABLED',
  'OLLAMA_EMBEDDING_MODEL',
] as const;

export type EmbeddingsManagedKey = (typeof EMBEDDINGS_MANAGED_KEYS)[number];

const SENSITIVE_KEYS = new Set<EmbeddingsManagedKey>([
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
  'VOYAGE_API_KEY',
  'OLLAMA_API_KEY',
]);

export interface EmbeddingsProviderCard {
  name: string;
  displayName: string;
  configured: boolean;
  local: boolean;
  keySet: boolean;
  baseUrlSet: boolean;
  baseUrl: string;
  embeddingModel: string;
  enabledFlag?: boolean;
}

export interface EmbeddingsPlatformStatus {
  status: EmbeddingProviderStatus;
  providers: EmbeddingsProviderCard[];
  preferredProvider: string;
  globalModel: string;
  maxChars: string;
  totalChunks: number;
  embeddedChunks: number;
  missingChunks: number;
  source: 'carina_settings' | 'env' | 'mixed' | 'none';
}

export interface SaveEmbeddingsPlatformInput {
  preferredProvider?: string;
  embeddingModel?: string;
  maxChars?: string;
  geminiApiKey?: string;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  voyageApiKey?: string;
  ollamaBaseUrl?: string;
  ollamaApiKey?: string;
  ollamaEnabled?: string | boolean;
  ollamaEmbeddingModel?: string;
}

function envPrefix(name: string): string {
  return name.toUpperCase().replace(/-/g, '_');
}

function embeddingModelForCard(def: ProviderDefinition): string {
  const prefixed = process.env[`${envPrefix(def.name)}_EMBEDDING_MODEL`]?.trim();
  if (prefixed) return prefixed;
  const globalModel = process.env.CARINA_EMBEDDING_MODEL?.trim();
  if (globalModel) return globalModel;
  if (def.kind === 'gemini') return config.embeddings.geminiModel;
  if (def.name === 'openai') return config.embeddings.openaiModel;
  return providerModel(def);
}

/**
 * Apply DB-saved embedding keys into process.env (DB wins over container env).
 */
export async function applyEmbeddingsSettingsFromDb(): Promise<Record<string, string>> {
  const saved = await readDomainSettings(EMBEDDINGS_DOMAIN, null);
  for (const key of EMBEDDINGS_MANAGED_KEYS) {
    const value = saved[key];
    if (value !== undefined && value !== null) {
      process.env[key] = value;
    }
  }
  return saved;
}

async function ragCoverage(): Promise<{
  totalChunks: number;
  embeddedChunks: number;
  missingChunks: number;
}> {
  try {
    const result = await pool.query<{
      total: string;
      embedded: string;
    }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(embedding)::text AS embedded
       FROM rag_chunks`,
    );
    const total = Number(result.rows[0]?.total ?? 0);
    const embedded = Number(result.rows[0]?.embedded ?? 0);
    return {
      totalChunks: total,
      embeddedChunks: embedded,
      missingChunks: Math.max(0, total - embedded),
    };
  } catch {
    return { totalChunks: 0, embeddedChunks: 0, missingChunks: 0 };
  }
}

function buildProviderCards(): EmbeddingsProviderCard[] {
  const defs = listEmbeddingProviders()
    .slice()
    .sort((a, b) => a.fallbackPriority - b.fallbackPriority);

  return defs.map((def) => {
    const key = providerApiKey(def).trim();
    const base = providerBaseUrl(def);
    const enabledFlag = def.local
      ? process.env[`${envPrefix(def.name)}_ENABLED`] === 'true'
        || process.env.CARINA_LOCAL_LLM_ENABLED === 'true'
      : undefined;
    return {
      name: def.name,
      displayName: def.displayName,
      configured: isEmbeddingProviderConfigured(def),
      local: Boolean(def.local),
      keySet: Boolean(key),
      baseUrlSet: Boolean(base),
      baseUrl: base,
      embeddingModel: embeddingModelForCard(def),
      enabledFlag,
    };
  });
}

export async function getEmbeddingsPlatformStatus(): Promise<EmbeddingsPlatformStatus> {
  const saved = await applyEmbeddingsSettingsFromDb();
  const coverage = await ragCoverage();
  const status = embeddingProviderStatus();
  const savedKeys = EMBEDDINGS_MANAGED_KEYS.filter((k) => saved[k] !== undefined);
  let source: EmbeddingsPlatformStatus['source'] = 'none';
  if (savedKeys.length > 0) {
    source = 'carina_settings';
  } else if (status.active || status.configured.length > 0) {
    source = 'env';
  }

  return {
    status,
    providers: buildProviderCards(),
    preferredProvider: (process.env.CARINA_EMBEDDING_PROVIDER ?? '').trim(),
    globalModel: (process.env.CARINA_EMBEDDING_MODEL ?? '').trim(),
    maxChars: (process.env.CARINA_EMBEDDING_MAX_CHARS ?? '').trim(),
    ...coverage,
    source,
  };
}

async function writeManaged(
  key: EmbeddingsManagedKey,
  value: string,
): Promise<{ ok: boolean; error?: string }> {
  return writeSetting({
    domainId: EMBEDDINGS_DOMAIN,
    key,
    value,
    sensitive: SENSITIVE_KEYS.has(key),
    envVar: key,
    workspaceId: null,
  });
}

export async function saveEmbeddingsPlatformConfig(
  input: SaveEmbeddingsPlatformInput,
): Promise<{ ok: boolean; error?: string }> {
  await applyEmbeddingsSettingsFromDb();

  const writes: Array<Promise<{ ok: boolean; error?: string }>> = [];

  if (input.preferredProvider !== undefined) {
    const pin = String(input.preferredProvider).trim().toLowerCase();
    if (pin && pin !== 'auto' && !PROVIDER_MAP[pin]) {
      return { ok: false, error: `Unknown provider: ${pin}` };
    }
    writes.push(writeManaged('CARINA_EMBEDDING_PROVIDER', pin === 'auto' ? '' : pin));
  }

  if (input.embeddingModel !== undefined) {
    writes.push(writeManaged('CARINA_EMBEDDING_MODEL', String(input.embeddingModel).trim()));
  }

  if (input.maxChars !== undefined) {
    const raw = String(input.maxChars).trim();
    if (raw) {
      const n = parseInt(raw, 10);
      if (!Number.isFinite(n) || n <= 0) {
        return { ok: false, error: 'maxChars must be a positive integer' };
      }
    }
    writes.push(writeManaged('CARINA_EMBEDDING_MAX_CHARS', raw));
  }

  const optionalSecrets: Array<[EmbeddingsManagedKey, string | undefined]> = [
    ['GEMINI_API_KEY', input.geminiApiKey],
    ['OPENAI_API_KEY', input.openaiApiKey],
    ['VOYAGE_API_KEY', input.voyageApiKey],
    ['OLLAMA_API_KEY', input.ollamaApiKey],
  ];
  for (const [key, value] of optionalSecrets) {
    if (value !== undefined && String(value).trim()) {
      writes.push(writeManaged(key, String(value).trim()));
    }
  }

  if (input.openaiBaseUrl !== undefined && String(input.openaiBaseUrl).trim()) {
    writes.push(writeManaged('OPENAI_BASE_URL', String(input.openaiBaseUrl).trim().replace(/\/$/, '')));
  }

  if (input.ollamaBaseUrl !== undefined && String(input.ollamaBaseUrl).trim()) {
    writes.push(writeManaged('OLLAMA_BASE_URL', String(input.ollamaBaseUrl).trim().replace(/\/$/, '')));
  }

  if (input.ollamaEmbeddingModel !== undefined && String(input.ollamaEmbeddingModel).trim()) {
    writes.push(writeManaged('OLLAMA_EMBEDDING_MODEL', String(input.ollamaEmbeddingModel).trim()));
  }

  if (input.ollamaEnabled !== undefined) {
    const enabled = input.ollamaEnabled === true
      || input.ollamaEnabled === 'true'
      || input.ollamaEnabled === '1'
      || input.ollamaEnabled === 'on';
    writes.push(writeManaged('OLLAMA_ENABLED', enabled ? 'true' : 'false'));
  }

  const results = await Promise.all(writes);
  for (const result of results) {
    if (!result.ok) return { ok: false, error: result.error ?? 'save failed' };
  }

  return { ok: true };
}

export async function probeEmbeddings(): Promise<{
  ok: boolean;
  active: string | null;
  dimensions: number;
  ms: number;
  error?: string;
}> {
  await applyEmbeddingsSettingsFromDb();
  const status = embeddingProviderStatus();
  const started = Date.now();
  try {
    const vector = await embed('ops embedding probe');
    const ms = Date.now() - started;
    if (vector.length === 0) {
      return {
        ok: false,
        active: status.active,
        dimensions: 0,
        ms,
        error: 'No embedding returned. Configure a provider and try again.',
      };
    }
    return {
      ok: true,
      active: status.active,
      dimensions: vector.length,
      ms,
    };
  } catch (err) {
    return {
      ok: false,
      active: status.active,
      dimensions: 0,
      ms: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

const BACKFILL_DEFAULT = 25;
const BACKFILL_MAX = 50;

export async function backfillMissingEmbeddings(limit?: number): Promise<{
  ok: boolean;
  attempted: number;
  updated: number;
  failed: number;
  remaining: number;
  active: string | null;
  error?: string;
}> {
  await applyEmbeddingsSettingsFromDb();
  const status = embeddingProviderStatus();
  const batch = Math.min(
    BACKFILL_MAX,
    Math.max(1, Number.isFinite(limit) ? Number(limit) : BACKFILL_DEFAULT),
  );

  let rows: Array<{ id: string; content: string }>;
  try {
    const result = await pool.query<{ id: string; content: string }>(
      `SELECT id, content
       FROM rag_chunks
       WHERE embedding IS NULL
       ORDER BY created_at ASC NULLS LAST, id ASC
       LIMIT $1`,
      [batch],
    );
    rows = result.rows;
  } catch (err) {
    return {
      ok: false,
      attempted: 0,
      updated: 0,
      failed: 0,
      remaining: 0,
      active: status.active,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  let updated = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const vector = await embed(row.content);
      if (vector.length === 0) {
        failed += 1;
        continue;
      }
      if (vector.length !== DIMENSIONS) {
        failed += 1;
        continue;
      }
      const vectorSql = pgvector.toSql(vector);
      await pool.query(
        `UPDATE rag_chunks SET embedding = $1 WHERE id = $2 AND embedding IS NULL`,
        [vectorSql, row.id],
      );
      updated += 1;
    } catch {
      failed += 1;
    }
  }

  let remaining = 0;
  try {
    const rem = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM rag_chunks WHERE embedding IS NULL`,
    );
    remaining = Number(rem.rows[0]?.count ?? 0);
  } catch {
    remaining = 0;
  }

  return {
    ok: failed === 0 || updated > 0,
    attempted: rows.length,
    updated,
    failed,
    remaining,
    active: status.active,
  };
}
