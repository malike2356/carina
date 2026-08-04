const STOP_WORDS = new Set([
  'about', 'after', 'also', 'been', 'before', 'being', 'between', 'could',
  'does', 'doing', 'during', 'each', 'from', 'have', 'having', 'into',
  'just', 'like', 'make', 'more', 'most', 'other', 'over', 'same', 'should',
  'some', 'such', 'than', 'that', 'their', 'them', 'then', 'there', 'these',
  'they', 'this', 'those', 'through', 'under', 'very', 'what', 'when',
  'where', 'which', 'while', 'with', 'would', 'your',
]);

/** Mirrors carina agent keyword extraction for offline eval parity. */
export function extractEvalKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w))
    .slice(0, 10);
}
