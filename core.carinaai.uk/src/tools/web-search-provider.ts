import { config } from '../config/index.js';

export interface WebSearchHit {
  title: string;
  url: string;
  description: string;
}

export type SearchProvider = 'brave' | 'tavily' | 'searxng';

interface BraveResult {
  title?: string;
  url?: string;
  description?: string;
}

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
}

function clampCount(count: number): number {
  return Math.max(1, Math.min(10, count));
}

export function resolveSearchProvider(): SearchProvider {
  const pref = config.search.provider;
  if (pref === 'brave') return 'brave';
  if (pref === 'tavily') return 'tavily';
  if (pref === 'searxng') return 'searxng';
  if (config.searxng.url) return 'searxng';
  if (config.tavily.apiKey) return 'tavily';
  if (config.brave.apiKey) return 'brave';
  throw new Error(
    'No search provider configured. Options: ' +
    'SEARCH_PROVIDER=searxng + SEARXNG_URL=http://localhost:8888, ' +
    'or TAVILY_API_KEY, or BRAVE_SEARCH_API_KEY.',
  );
}

export function searchProviderLabel(provider: SearchProvider): string {
  if (provider === 'tavily') return 'Tavily';
  if (provider === 'brave') return 'Brave Search';
  return 'SearXNG';
}

/** Runtime blerb for the agent system prompt (never mention Brave unless it is active). */
export function buildSearchProviderContext(): string {
  const configured = Boolean(config.searxng.url || config.tavily.apiKey || config.brave.apiKey);
  if (!configured) {
    return (
      'Web search is not configured. Set SEARXNG_URL, TAVILY_API_KEY, or BRAVE_SEARCH_API_KEY in .env. ' +
      'Until then, do not claim you can search the web.'
    );
  }
  try {
    const provider = resolveSearchProvider();
    if (provider === 'searxng') {
      return (
        'Web search is configured (SearXNG self-hosted). Use the web-search tool for any current information lookup. ' +
        'Results include title, url, and snippet from multiple engines.'
      );
    }
    return (
      `Web search is available via the web-search tool (${searchProviderLabel(provider)}). ` +
      'When the user asks for live or current web information, call web-search with a query. ' +
      'Do not use search-files for web lookups. Do not mention Brave Search unless SEARCH_PROVIDER=brave.'
    );
  } catch {
    return (
      'Web search is not configured. Set SEARXNG_URL, TAVILY_API_KEY, or BRAVE_SEARCH_API_KEY in .env. ' +
      'Until then, do not claim you can search the web.'
    );
  }
}

export async function searchBrave(query: string, count: number): Promise<WebSearchHit[]> {
  if (!config.brave.apiKey) {
    throw new Error('BRAVE_SEARCH_API_KEY not set in .env');
  }

  const capped = clampCount(count);
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(capped));

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
  return (data.web?.results ?? []).slice(0, capped).map((r) => ({
    title: r.title ?? '',
    url: r.url ?? '',
    description: r.description ?? '',
  }));
}

export async function searchTavily(query: string, count: number): Promise<WebSearchHit[]> {
  if (!config.tavily.apiKey) {
    throw new Error('TAVILY_API_KEY not set in .env');
  }

  const capped = clampCount(count);
  const depth = config.tavily.searchDepth === 'advanced' ? 'advanced' : 'basic';

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: config.tavily.apiKey,
      query,
      search_depth: depth,
      max_results: capped,
      include_answer: false,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch((): string => '');
    const suffix = detail ? `: ${detail.slice(0, 200)}` : '';
    throw new Error(`Tavily Search failed: ${res.status} ${res.statusText}${suffix}`);
  }

  const data = (await res.json()) as { results?: TavilyResult[] };
  return (data.results ?? []).slice(0, capped).map((r) => ({
    title: r.title ?? '',
    url: r.url ?? '',
    description: r.content ?? '',
  }));
}

export async function searchSearxng(
  query: string,
  count = 10,
): Promise<Array<{ title: string; url: string; content: string }>> {
  if (!config.searxng.url) throw new Error('SEARXNG_URL is not configured');
  const url = new URL('/search', config.searxng.url);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('categories', 'general');
  url.searchParams.set('language', 'en');
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`SearXNG error: HTTP ${res.status}`);
  const data = await res.json() as { results?: Array<{ title?: string; url?: string; content?: string }> };
  return (data.results ?? []).slice(0, clampCount(count)).map((r) => ({
    title: r.title ?? '',
    url: r.url ?? '',
    content: r.content ?? '',
  }));
}

export async function runWebSearch(query: string, count: number): Promise<WebSearchHit[]> {
  const provider = resolveSearchProvider();
  if (provider === 'searxng') {
    const results = await searchSearxng(query, count);
    return results.map((r) => ({
      title: r.title,
      url: r.url,
      description: r.content,
    }));
  }
  if (provider === 'tavily') {
    return searchTavily(query, count);
  }
  return searchBrave(query, count);
}
