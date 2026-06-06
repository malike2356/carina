import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/index.js';

// 768: Gemini text-embedding-004 native size; OpenAI text-embedding-3-small configurable to match.
// DeepSeek has no embeddings API.
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

export async function embed(text: string): Promise<number[]> {
  // 1. Gemini (primary - cheapest: ~$0.00001/1K chars)
  if (getGeminiClient()) {
    try {
      return await embedWithGemini(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`Gemini embedding failed (${msg}); trying OpenAI...`);
    }
  }

  // 2. OpenAI (fallback)
  if (getOpenAIClient()) {
    try {
      return await embedWithOpenAI(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`OpenAI embedding failed (${msg}); memory search degraded.`);
    }
  }

  if (!getGeminiClient() && !getOpenAIClient()) {
    console.warn('No embedding provider available. Add GEMINI_API_KEY or OPENAI_API_KEY to .env');
  }

  return [];
}
