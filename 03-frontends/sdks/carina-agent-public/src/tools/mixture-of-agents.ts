import type { Tool } from '../types/index.js';
import { llm } from '../brain/llm.js';
import type { Message } from '../types/index.js';

export const mixtureOfAgentsTool: Tool = {
  name: 'mixture-of-agents',
  description:
    'Query multiple LLM providers in parallel and synthesize a single answer. Useful for high-stakes decisions or cross-checking reasoning.',
  parameters: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'Question or task for all providers' },
      providers: {
        type: 'array',
        items: { type: 'string' },
        description: 'Provider names to query (default: all configured)',
      },
      synthesize: {
        type: 'boolean',
        description: 'Merge responses via cheap provider (default true)',
      },
    },
    required: ['prompt'],
  },
  execute: async (params) => {
    const prompt = String(params.prompt ?? '').trim();
    if (!prompt) return { error: 'prompt is required' };

    const available = llm.list();
    const requested = Array.isArray(params.providers)
      ? (params.providers as string[]).map(String).filter((p) => available.includes(p))
      : available;

    if (requested.length === 0) {
      return { error: 'no configured providers available' };
    }

    const messages: Message[] = [{ role: 'user', content: prompt, timestamp: new Date() }];
    const responses: Array<{ provider: string; content: string }> = [];

    await Promise.all(requested.map(async (providerName) => {
      try {
        const result = await llm.chat(messages, undefined, { name: providerName });
        responses.push({ provider: providerName, content: result.content });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        responses.push({ provider: providerName, content: `[error: ${msg}]` });
      }
    }));

    const synthesize = params.synthesize !== false;
    if (!synthesize || responses.length === 1) {
      return { responses, synthesized: responses[0]?.content ?? '' };
    }

    const mergePrompt = [
      'You are synthesizing answers from multiple AI models.',
      'Combine the best reasoning into one clear, accurate response.',
      'Do not mention that multiple models were consulted.',
      '',
      ...responses.map((r) => `--- ${r.provider} ---\n${r.content}`),
      '',
      'Synthesized answer:',
    ].join('\n');

    const merged = await llm.chatCheap([
      { role: 'user', content: mergePrompt, timestamp: new Date() },
    ]);

    return {
      responses,
      synthesized: merged.content,
      synthesis_provider: merged.provider,
    };
  },
};
