export interface FuzzyItem {
  score: number;
  item: string;
}

function scoreMatch(text: string, query: string): number {
  const hay = text.toLowerCase();
  const needle = query.toLowerCase().trim();
  if (!needle) return 1;
  if (hay === needle) return 100;
  if (hay.startsWith(needle)) return 80;
  if (hay.includes(needle)) return 60;

  let qi = 0;
  let consecutive = 0;
  let bestRun = 0;
  for (let i = 0; i < hay.length && qi < needle.length; i += 1) {
    if (hay[i] === needle[qi]) {
      qi += 1;
      consecutive += 1;
      bestRun = Math.max(bestRun, consecutive);
    } else {
      consecutive = 0;
    }
  }
  if (qi < needle.length) return 0;
  return 20 + bestRun * 5;
}

export function fuzzyFilter(items: string[], query: string, limit = 20): string[] {
  if (!query.trim()) return items.slice(0, limit);
  return items
    .map((item) => ({ item, score: scoreMatch(item, query) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.item);
}

export function fuzzyFilterRecords<T extends Record<string, unknown>>(
  items: T[],
  query: string,
  keys: string[],
  limit = 20,
): T[] {
  if (!query.trim()) return items.slice(0, limit);
  return items
    .map((item) => {
      const combined = keys.map((k) => String(item[k] ?? '')).join(' ');
      return { item, score: scoreMatch(combined, query) };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.item);
}
