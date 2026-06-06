import { config } from '../config/index.js';
import type { Tool } from '../types/index.js';

interface BraveResult {
  title?: string;
  url?: string;
  description?: string;
}

export const webSearchTool: Tool = {
  name: 'web-search',
  description:
    'Search the web using Brave Search. Use when you need current information not in your training data.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query' },
      count: { type: 'number', description: 'Number of results (1-10)', default: 5 },
    },
    required: ['query'],
  },
  execute: async (params) => {
    const query = String(params.query ?? '');
    const count = Math.min(10, Math.max(1, Number(params.count ?? 5)));

    if (!config.brave.apiKey) {
      throw new Error('BRAVE_SEARCH_API_KEY not set in .env');
    }

    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', query);
    url.searchParams.set('count', String(count));

    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': config.brave.apiKey,
      },
    });

    if (!res.ok) {
      throw new Error(`Brave Search failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as { web?: { results?: BraveResult[] } };
    const results = (data.web?.results ?? []).slice(0, 5);

    return results.map((r) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      description: r.description ?? '',
    }));
  },
};
