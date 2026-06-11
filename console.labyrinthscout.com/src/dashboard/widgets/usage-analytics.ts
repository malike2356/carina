export interface UsageEventRow {
  metadata: Record<string, unknown> | string | null;
  description?: string | null;
}

export interface UsageAnalyticsSummary {
  used: number;
  limit: number;
  percentage: number;
  window: '24h';
  /** Not billing-grade; derived from event metadata heuristics. */
  estimated: true;
  label: string;
}

export function buildUsageAnalytics(
  rows: UsageEventRow[],
  limit = Number(process.env.SCOUT_TOKEN_LIMIT_24H ?? '1000000'),
): UsageAnalyticsSummary {
  const used = rows.reduce((sum, row) => sum + tokenCount(row), 0);
  const safeLimit = Math.max(1, limit);
  return {
    used,
    limit: safeLimit,
    percentage: Math.min(100, Math.round((used / safeLimit) * 100)),
    window: '24h',
    estimated: true,
    label: 'Estimated from event metadata; not billing-grade usage',
  };
}

function tokenCount(row: UsageEventRow): number {
  const metadata = typeof row.metadata === 'string' ? parseMetadata(row.metadata) : row.metadata;
  const fromMetadata =
    numberValue(metadata?.tokens_used) ??
    numberValue(metadata?.tokensUsed) ??
    numberValue(metadata?.total_tokens) ??
    numberValue(metadata?.totalTokens) ??
    numberValue(metadata?.prompt_tokens) ??
    0;

  if (fromMetadata > 0) return fromMetadata;

  if (typeof row.description !== 'string') return 0;
  try {
    const parsed = JSON.parse(row.description) as Record<string, unknown>;
    return numberValue(parsed.tokens_used) ?? numberValue(parsed.total_tokens) ?? 0;
  } catch {
    return 0;
  }
}

function parseMetadata(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function numberValue(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}
