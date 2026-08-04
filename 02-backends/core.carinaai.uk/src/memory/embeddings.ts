import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/index.js';
import {
  PROVIDER_MAP,
  isEmbeddingProviderConfigured,
  listEmbeddingProviders,
  providerApiKey,
  providerBaseUrl,
  providerModel,
  type ProviderDefinition,
} from '../brain/provider-registry.js';

export const DIMENSIONS = config.embeddings.dimensions;

export interface EmbeddingProviderStatus {
  active: string | null;
  configured: string[];
  chain: string[];
  dimensions: number;
  override: string | null;
}

let geminiClient: GoogleGenerativeAI | null = null;

function getGeminiClient(apiKey: string): GoogleGenerativeAI {
  geminiClient ??= new GoogleGenerativeAI(apiKey);
  return geminiClient;
}

function embeddingMaxChars(forVoyage = false): number {
  const fromEnv = process.env.CARINA_EMBEDDING_MAX_CHARS;
  if (fromEnv) {
    const parsed = parseInt(fromEnv, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return forVoyage ? config.embeddings.voyageMaxChars : config.embeddings.maxChars;
}

function envPrefix(name: string): string {
  return name.toUpperCase().replace(/-/g, '_');
}

/** True when this registry entry may be used for RAG / memory embeddings. */
export function providerSupportsEmbeddings(def: ProviderDefinition): boolean {
  if (def.capabilities.embeddings) return true;
  if (def.kind === 'gemini') return true;
  return false;
}

function embeddingModelFor(def: ProviderDefinition): string {
  const prefixed = process.env[`${envPrefix(def.name)}_EMBEDDING_MODEL`]?.trim();
  if (prefixed) return prefixed;
  const globalModel = process.env.CARINA_EMBEDDING_MODEL?.trim();
  if (globalModel) return globalModel;
  if (def.kind === 'gemini') return config.embeddings.geminiModel;
  if (def.name === 'openai') return config.embeddings.openaiModel;
  if (def.embeddingOnly) return providerModel(def);
  return providerModel(def);
}

function embeddingOverride(): string | null {
  const raw = (process.env.CARINA_EMBEDDING_PROVIDER ?? '').trim().toLowerCase();
  return raw || null;
}

function configuredEmbeddingProviders(): ProviderDefinition[] {
  return listEmbeddingProviders()
    .filter((def) => isEmbeddingProviderConfigured(def))
    .filter((def) => providerSupportsEmbeddings(def) || def.kind === 'gemini')
    .slice()
    .sort((a, b) => a.fallbackPriority - b.fallbackPriority);
}

/**
 * Ordered embedding backends from whatever providers are configured.
 * Optional CARINA_EMBEDDING_PROVIDER pins one name first; others remain as fallback.
 */
export function resolveEmbeddingChain(): string[] {
  const configured = configuredEmbeddingProviders();
  const names = configured.map((d) => d.name);
  const override = embeddingOverride();
  if (!override) return names;
  if (!PROVIDER_MAP[override]) return names;
  const rest = names.filter((n) => n !== override);
  const overrideDef = PROVIDER_MAP[override];
  const overrideReady =
    overrideDef
    && (isEmbeddingProviderConfigured({
      ...overrideDef,
      capabilities: { ...overrideDef.capabilities, embeddings: true },
    })
      || Boolean(providerApiKey(overrideDef).trim()));
  if (!overrideReady) return names;
  return [override, ...rest];
}

export function embeddingProviderStatus(): EmbeddingProviderStatus {
  const chain = resolveEmbeddingChain();
  return {
    active: chain[0] ?? null,
    configured: configuredEmbeddingProviders().map((d) => d.name),
    chain,
    dimensions: DIMENSIONS,
    override: embeddingOverride(),
  };
}

async function embedWithGemini(def: ProviderDefinition, text: string): Promise<number[]> {
  const apiKey = providerApiKey(def).trim() || config.gemini.apiKey;
  if (!apiKey) throw new Error('Gemini API key missing');
  const client = getGeminiClient(apiKey);
  const model = client.getGenerativeModel(
    { model: embeddingModelFor(def) },
    { apiVersion: 'v1' },
  );
  const result = await model.embedContent({
    content: { role: 'user', parts: [{ text: text.slice(0, embeddingMaxChars()) }] },
    taskType: 'RETRIEVAL_DOCUMENT' as never,
  });
  return result.embedding.values;
}

/**
 * OpenAI-compatible POST /embeddings for any registry provider with a base URL.
 * Voyage and similar may send extra fields; dimensions stay fixed to the DB schema.
 */
async function embedOpenAiCompatible(def: ProviderDefinition, text: string): Promise<number[]> {
  const apiKey = providerApiKey(def).trim();
  const base = providerBaseUrl(def);
  if (!base) throw new Error(`${def.name}: embedding base URL missing`);
  if (!apiKey && !def.local) throw new Error(`${def.name}: API key missing`);

  const model = embeddingModelFor(def);
  const isVoyage = def.name === 'voyage' || /voyageai\.com/i.test(base);
  const body: Record<string, unknown> = isVoyage
    ? {
        model,
        input: text.slice(0, embeddingMaxChars(true)),
        input_type: 'document',
        output_dimension: DIMENSIONS,
      }
    : {
        model,
        input: text.slice(0, embeddingMaxChars()),
        dimensions: DIMENSIONS,
      };

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const res = await fetch(`${base}/embeddings`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`${def.name} embeddings HTTP ${res.status}${detail ? `: ${detail.slice(0, 180)}` : ''}`);
  }
  const data = (await res.json()) as { data?: Array<{ embedding: number[] }> };
  return data.data?.[0]?.embedding ?? [];
}

async function embedWithProvider(name: string, text: string): Promise<number[]> {
  const def = PROVIDER_MAP[name];
  if (!def) throw new Error(`Unknown embedding provider: ${name}`);
  if (def.kind === 'gemini') return embedWithGemini(def, text);
  return embedOpenAiCompatible(def, text);
}

export async function embed(text: string): Promise<number[]> {
  const chain = resolveEmbeddingChain();
  const quiet = process.env.CARINA_OPS_PTY === '1' || process.env.CARINA_EMBEDDING_QUIET === 'true';
  for (const providerId of chain) {
    try {
      const vector = await embedWithProvider(providerId, text);
      if (vector.length > 0) return vector;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const next = chain[chain.indexOf(providerId) + 1];
      if (!quiet) {
        if (next) {
          console.warn(`${providerId} embedding failed (${msg}); trying ${next}...`);
        } else {
          console.warn(`${providerId} embedding failed (${msg}); memory search degraded.`);
        }
      }
    }
  }

  if (chain.length === 0 && !quiet) {
    console.warn(
      'No embedding provider available. Configure any provider with embeddings support (for example GEMINI_API_KEY, VOYAGE_API_KEY, OPENAI_API_KEY, or a local OpenAI-compatible embed endpoint).',
    );
  }

  return [];
}
