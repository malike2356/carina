/** Turn unknown thrown values into a readable message (avoid "[object Object]"). */
export function formatUnknownError(err: unknown): string {
  if (err instanceof Error) {
    return err.message || err.name || 'Unknown error';
  }
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const record = err as Record<string, unknown>;
    for (const key of ['message', 'error', 'detail', 'title'] as const) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return 'Unknown error';
    }
  }
  return String(err);
}
