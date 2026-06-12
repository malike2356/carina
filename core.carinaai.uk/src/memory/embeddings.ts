import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/index.js';

// 768: Gemini text-embedding-004 native size; OpenAI text-embedding-3-small configurable to match.
// Voyage voyage-3 with output_dimension=768 also matches this size.
export const DIMENSIONS = 768;

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

async function embedWithGemini(text: string): Promise<number[]> {
  const client = getGeminiClient()!;
  const model = client.getGenerativeModel({ model: 'text-embedding-004' });
  const result = await model.embedContent({
    content: { role: 'user', parts: [{ text: text.slice(0, 8000) }] },
    taskType: 'RETRIEVAL_DOCUMENT' as never,
  });
  return result.embedding.values;
}

async function embedWithOpenAI(text: string): Promise<number[]> {
  const client = getOpenAIClient()!;
  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),
    dimensions: DIMENSIONS,
  });
  return response.data[0]?.embedding ?? [];
}

async function embedWithVoyage(text: string): Promise<number[]> {
  const apiKey = getVoyageApiKey()!;
  const model = process.env.VOYAGE_MODEL ?? 'voyage-3';
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: text.slice(0, 16000),
      input_type: 'document',
      output_dimension: DIMENSIONS,
    }),
  });
  if (!res.ok) throw new Error(`Voyage API error: ${res.status}`);
  const data = await res.json() as { data?: Array<{ embedding: number[] }> };
  return data.data?.[0]?.embedding ?? [];
}

export async function embed(text: string): Promise<number[]> {
  // 1. Gemini (primary - cheapest: ~$0.00001/1K chars)
  if (getGeminiClient()) {
    try {
      return await embedWithGemini(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`Gemini embedding failed (${msg}); trying Voyage...`);
    }
  }

  // 2. Voyage (strong retrieval quality; set VOYAGE_API_KEY to enable)
  if (getVoyageApiKey()) {
    try {
      return await embedWithVoyage(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`Voyage embedding failed (${msg}); trying OpenAI...`);
    }
  }

  // 3. OpenAI (fallback)
  if (getOpenAIClient()) {
    try {
      return await embedWithOpenAI(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`OpenAI embedding failed (${msg}); memory search degraded.`);
    }
  }

  if (!getGeminiClient() && !getVoyageApiKey() && !getOpenAIClient()) {
    console.warn('No embedding provider available. Add GEMINI_API_KEY, VOYAGE_API_KEY, or OPENAI_API_KEY to .env');
  }

  return [];
}
