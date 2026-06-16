import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/index.js';
import { PROVIDER_MAP, isEmbeddingProviderConfigured, providerBaseUrl } from '../brain/provider-registry.js';

export const DIMENSIONS = config.embeddings.dimensions;

export type EmbeddingProviderId = 'gemini' | 'voyage' | 'openai';

export interface EmbeddingProviderStatus {
  active: EmbeddingProviderId | null;
  configured: EmbeddingProviderId[];
  chain: EmbeddingProviderId[];
  dimensions: number;
  override: string | null;
}

let geminiClient: GoogleGenerativeAI | null = null;
let openaiClient: OpenAI | null = null;

function getGeminiClient(): GoogleGenerativeAI | null {
  if (!config.gemini.apiKey) return null;
  geminiClient ??= new GoogleGenerativeAI(config.gemini.apiKey);
  return geminiClient;
}

function getOpenAIClient(): OpenAI | null {
  if (!config.openai.apiKey) return null;
  openaiClient ??= new OpenAI({ apiKey: config.openai.apiKey });
  return openaiClient;
}

function getVoyageApiKey(): string | null {
  return process.env.VOYAGE_API_KEY ?? null;
}

function embeddingMaxChars(forVoyage = false): number {
  const fromEnv = process.env.CARINA_EMBEDDING_MAX_CHARS;
  if (fromEnv) {
    const parsed = parseInt(fromEnv, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return forVoyage ? config.embeddings.voyageMaxChars : config.embeddings.maxChars;
}

function voyageEmbeddingsUrl(): string {
  const voyageDef = PROVIDER_MAP.voyage;
  const base = voyageDef ? providerBaseUrl(voyageDef) : 'https://api.voyageai.com/v1';
  return `${base}/embeddings`;
}

function embeddingOverride(): EmbeddingProviderId | null {
  const raw = (process.env.CARINA_EMBEDDING_PROVIDER ?? '').trim().toLowerCase();
  if (raw === 'gemini' || raw === 'voyage' || raw === 'openai') return raw;
  return null;
}

function providerAvailable(id: EmbeddingProviderId): boolean {
  if (id === 'gemini') return Boolean(getGeminiClient());
  if (id === 'voyage') {
    const voyageDef = PROVIDER_MAP.voyage;
    return voyageDef ? isEmbeddingProviderConfigured(voyageDef) : Boolean(getVoyageApiKey());
  }
  return Boolean(getOpenAIClient());
}

/** Ordered embedding backends for RAG, memory search, and ingestion. */
export function resolveEmbeddingChain(): EmbeddingProviderId[] {
  const override = embeddingOverride();
  if (override) {
    const rest: EmbeddingProviderId[] = (['gemini', 'voyage', 'openai'] as EmbeddingProviderId[]).filter((id) => id !== override);
    return [override, ...rest.filter((id) => providerAvailable(id))];
  }
  const chain: EmbeddingProviderId[] = [];
  if (providerAvailable('gemini')) chain.push('gemini');
  if (providerAvailable('voyage')) chain.push('voyage');
  if (providerAvailable('openai')) chain.push('openai');
  return chain;
}

export function embeddingProviderStatus(): EmbeddingProviderStatus {
  const configured = (['gemini', 'voyage', 'openai'] as const).filter((id) => providerAvailable(id));
  const chain = resolveEmbeddingChain();
  return {
    active: chain[0] ?? null,
    configured,
    chain,
    dimensions: DIMENSIONS,
    override: embeddingOverride(),
  };
}

async function embedWithGemini(text: string): Promise<number[]> {
  const client = getGeminiClient()!;
  const model = client.getGenerativeModel({ model: config.embeddings.geminiModel }, { apiVersion: 'v1' });
  const result = await model.embedContent({
    content: { role: 'user', parts: [{ text: text.slice(0, embeddingMaxChars()) }] },
    taskType: 'RETRIEVAL_DOCUMENT' as never,
  });
  return result.embedding.values;
}

async function embedWithOpenAI(text: string): Promise<number[]> {
  const client = getOpenAIClient()!;
  const response = await client.embeddings.create({
    model: config.embeddings.openaiModel,
    input: text.slice(0, embeddingMaxChars()),
    dimensions: DIMENSIONS,
  });
  return response.data[0]?.embedding ?? [];
}

async function embedWithVoyage(text: string): Promise<number[]> {
  const apiKey = getVoyageApiKey()!;
  const model = process.env.VOYAGE_MODEL ?? 'voyage-3';
  const res = await fetch(voyageEmbeddingsUrl(), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: text.slice(0, embeddingMaxChars(true)),
      input_type: 'document',
      output_dimension: DIMENSIONS,
    }),
  });
  if (!res.ok) throw new Error(`Voyage API error: ${res.status}`);
  const data = await res.json() as { data?: Array<{ embedding: number[] }> };
  return data.data?.[0]?.embedding ?? [];
}

async function embedWithProvider(id: EmbeddingProviderId, text: string): Promise<number[]> {
  switch (id) {
    case 'gemini':
      return embedWithGemini(text);
    case 'voyage':
      return embedWithVoyage(text);
    case 'openai':
      return embedWithOpenAI(text);
    default:
      return [];
  }
}

export async function embed(text: string): Promise<number[]> {
  const chain = resolveEmbeddingChain();
  for (const providerId of chain) {
    try {
      return await embedWithProvider(providerId, text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const next = chain[chain.indexOf(providerId) + 1];
      if (next) {
        console.warn(`${providerId} embedding failed (${msg}); trying ${next}...`);
      } else {
        console.warn(`${providerId} embedding failed (${msg}); memory search degraded.`);
      }
    }
  }

  if (chain.length === 0) {
    console.warn('No embedding provider available. Add GEMINI_API_KEY, VOYAGE_API_KEY, or OPENAI_API_KEY to .env');
  }

  return [];
}
