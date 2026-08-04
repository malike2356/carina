import { resolveCoreProxyToken, resolveCoreUrl } from '@/lib/core-proxy';

export interface CoreResearchSource {
  url: string;
  title: string;
  snippet: string;
}

export interface CoreResearchRunResult {
  markdown: string;
  sources: CoreResearchSource[];
}

export function researchCoreConfigured(): boolean {
  return Boolean(resolveResearchCoreKey());
}

export function resolveResearchCoreKey(): string {
  return resolveCoreProxyToken();
}

export function resolveResearchCallbackUrl(jobId: string): string {
  // Prefer Docker-internal callback so core can finish jobs without hairpinning
  // through the public internet (and survive brief public-edge blips).
  const internalBase =
    process.env.CARINA_CLOUD_INTERNAL_URL?.trim()
    || (process.env.NODE_ENV === 'production' ? 'http://carina-cloud:4100' : '');
  const publicBase = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:4100';
  const base = (internalBase || publicBase).replace(/\/$/, '');
  return `${base}/api/research/${jobId}/webhook`;
}

export function buildResearchQuery(query: string, mode: string): string {
  if (!mode || mode === 'auto') return query;
  return `Research mode: ${mode}. Topic: ${query}`;
}

function coreAuthHeaders(): Record<string, string> {
  const token = resolveResearchCoreKey();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers['x-internal-key'] = token;
  }
  return headers;
}

export async function startAsyncCoreResearch(input: {
  jobId: string;
  workspaceId: string;
  query: string;
  mode: string;
  rounds: number;
  citationStyle?: string;
}): Promise<{ accepted: boolean; status: number; body: string }> {
  const coreUrl = resolveCoreUrl();
  const response = await fetch(`${coreUrl}/api/research/cloud/run`, {
    method: 'POST',
    headers: coreAuthHeaders(),
    body: JSON.stringify({
      jobId: input.jobId,
      workspaceId: input.workspaceId,
      query: input.query,
      mode: input.mode,
      maxRounds: input.rounds,
      citationStyle: input.citationStyle ?? 'apa7',
      callbackUrl: resolveResearchCallbackUrl(input.jobId),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.text();
  return { accepted: response.ok, status: response.status, body };
}

export async function runSyncCoreResearch(input: {
  query: string;
  mode: string;
  rounds: number;
  citationStyle?: string;
}): Promise<CoreResearchRunResult> {
  const coreUrl = resolveCoreUrl();
  const response = await fetch(`${coreUrl}/api/research/run`, {
    method: 'POST',
    headers: coreAuthHeaders(),
    body: JSON.stringify({
      query: buildResearchQuery(input.query, input.mode),
      maxRounds: input.rounds,
      citationStyle: input.citationStyle ?? 'apa7',
    }),
    signal: AbortSignal.timeout(600_000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Core research failed (${response.status})`);
  }

  const data = (await response.json()) as {
    markdown?: string;
    report?: {
      sources?: Array<{ url?: string; title?: string; snippet?: string }>;
    };
  };

  const sources = (data.report?.sources ?? [])
    .map((source) => ({
      url: String(source.url ?? ''),
      title: String(source.title ?? source.url ?? 'Source'),
      snippet: String(source.snippet ?? ''),
    }))
    .filter((source) => source.url);

  return {
    markdown: String(data.markdown ?? ''),
    sources,
  };
}
