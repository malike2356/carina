const EMPTY_COLLECTION_KEYS = [
  'results',
  'contacts',
  'items',
  'files',
  'documents',
  'data',
  'matches',
  'rows',
  'entries',
  'hits',
  'records',
] as const;

const META_KEYS = new Set([
  'count',
  'total',
  'totalCount',
  'found',
  'query',
  'action',
  'ok',
  'success',
  'status',
  'mode',
]);

function hasNonVacuousSibling(
  obj: Record<string, unknown>,
  emptyKey: string,
): boolean {
  for (const [key, value] of Object.entries(obj)) {
    if (key === emptyKey || META_KEYS.has(key)) continue;
    if (value == null || value === '' || value === false) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (
      typeof value === 'object'
      && !Array.isArray(value)
      && Object.keys(value as object).length === 0
    ) {
      continue;
    }
    return true;
  }
  return false;
}

/**
 * True when a tool result is null/empty/zero-hit so the model must not invent data.
 */
export function isVacuousToolResult(result: unknown): boolean {
  if (result == null) return true;
  if (typeof result === 'string') return result.trim().length === 0;
  if (Array.isArray(result)) return result.length === 0;
  if (typeof result !== 'object') return false;

  const obj = result as Record<string, unknown>;
  if (typeof obj.error === 'string' && obj.error.trim()) return false;
  if (obj.status === 'error' || obj.status === 'empty') return false;

  const keys = Object.keys(obj);
  if (keys.length === 0) return true;

  for (const key of EMPTY_COLLECTION_KEYS) {
    if (!(key in obj)) continue;
    const value = obj[key];
    if (!Array.isArray(value) || value.length > 0) continue;
    const count = obj.count ?? obj.total ?? obj.totalCount ?? obj.found;
    if (count !== undefined && count !== 0) continue;
    if (!hasNonVacuousSibling(obj, key)) return true;
  }

  return false;
}

/**
 * Inject an explicit empty marker into LLM context when a tool returns zero data.
 */
export function guardEmptyToolResult(toolName: string, result: unknown): unknown {
  if (!isVacuousToolResult(result)) return result;
  return {
    status: 'empty',
    code: 'TOOL_EMPTY_RESULT',
    message:
      `Tool ${toolName} returned zero results or empty data. `
      + 'Do not invent records. State explicitly: '
      + '"I searched and found no matching records."',
    result: result ?? null,
  };
}
