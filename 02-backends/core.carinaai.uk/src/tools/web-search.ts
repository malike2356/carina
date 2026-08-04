import type { Tool } from '../types/index.js';
import { runWebSearch, searchProviderLabel, resolveSearchProvider } from './web-search-provider.js';

export const webSearchTool: Tool = {
  name: 'web-search',
  description:
    'Live web search (SearXNG, Tavily, or Brave depending on config). Call with a search query when the user needs current facts, news, or URLs. Do not use for local file lookup.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query' },
      count: { type: 'number', description: 'Number of results (1-10)', default: 5 },
    },
    required: ['query'],
  },
  execute: async (params) => {
    const query = String(params.query ?? '').trim();
    if (!query) {
      throw new Error('web-search requires a non-empty query');
    }
    const count = Math.max(1, Math.min(10, Number(params['count'] ?? 5)));
    resolveSearchProvider();
    return runWebSearch(query, count);
  },
};

export { resolveSearchProvider, searchProviderLabel, runWebSearch };
