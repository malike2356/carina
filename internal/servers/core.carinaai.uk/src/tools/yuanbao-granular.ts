import type { Tool } from '../types/index.js';
import { webSearchTool } from './web-search.js';

async function hunyuanChat(prompt: string, model?: string): Promise<unknown> {
  const apiKey = process.env.HUNYUAN_API_KEY ?? process.env.YUANBAO_API_KEY ?? '';
  if (!apiKey) return { error: 'Set HUNYUAN_API_KEY or YUANBAO_API_KEY' };

  const response = await fetch('https://api.hunyuan.cloud.tencent.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model ?? process.env.HUNYUAN_MODEL ?? 'hunyuan-lite',
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const data = await response.json();
  return { source: 'hunyuan_api', status: response.status, data };
}

export const ybChatTool: Tool = {
  name: 'yb-chat',
  description: 'Chat with Tencent Hunyuan/Yuanbao API.',
  parameters: {
    type: 'object',
    properties: {
      prompt: { type: 'string' },
      model: { type: 'string' },
    },
    required: ['prompt'],
  },
  execute: async (params) => {
    const prompt = String(params.prompt ?? '').trim();
    if (!prompt) return { error: 'prompt is required' };
    const result = await hunyuanChat(prompt, params.model ? String(params.model) : undefined);
    if ('error' in (result as Record<string, unknown>)) {
      const fallback = await webSearchTool.execute({ query: `Tencent Yuanbao ${prompt}` });
      return { source: 'web_search_fallback', results: fallback };
    }
    return result;
  },
};

export const ybSearchTool: Tool = {
  name: 'yb-search',
  description: 'Search Yuanbao/Hunyuan knowledge or fall back to web search.',
  parameters: {
    type: 'object',
    properties: { query: { type: 'string' } },
    required: ['query'],
  },
  execute: async (params) => {
    const query = String(params.query ?? '').trim();
    if (!query) return { error: 'query is required' };
    const apiKey = process.env.HUNYUAN_API_KEY ?? process.env.YUANBAO_API_KEY ?? '';
    if (apiKey) {
      return hunyuanChat(`Search and summarize: ${query}`);
    }
    return webSearchTool.execute({ query: `Tencent Yuanbao ${query}` });
  },
};
