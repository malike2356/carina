import { CARINA_HELP_KNOWLEDGE_BASE } from '@/lib/carina-help/knowledge';

type Chunk = {
  id: number;
  title: string;
  content: string;
  tokens: string[];
};

const CHUNK_CHARS = 900;
const OVERLAP = 120;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_\-/.@]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && t.length < 48);
}

function buildChunks(source: string): Chunk[] {
  const sections = source.split(/\n(?=# )/g);
  const chunks: Chunk[] = [];
  let id = 0;

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;
    const titleMatch = trimmed.match(/^#\s+(.+)/);
    const title = titleMatch?.[1]?.trim() || 'Aiva help';
    if (trimmed.length <= CHUNK_CHARS) {
      chunks.push({
        id: id++,
        title,
        content: trimmed,
        tokens: tokenize(trimmed),
      });
      continue;
    }
    let start = 0;
    while (start < trimmed.length) {
      const end = Math.min(trimmed.length, start + CHUNK_CHARS);
      const slice = trimmed.slice(start, end);
      chunks.push({
        id: id++,
        title,
        content: slice,
        tokens: tokenize(slice),
      });
      if (end >= trimmed.length) break;
      start = Math.max(0, end - OVERLAP);
    }
  }

  return chunks;
}

const chunks = buildChunks(CARINA_HELP_KNOWLEDGE_BASE);
const docFreq = new Map<string, number>();
let avgDocLen = 0;

for (const chunk of chunks) {
  avgDocLen += chunk.tokens.length;
  const unique = new Set(chunk.tokens);
  for (const token of unique) {
    docFreq.set(token, (docFreq.get(token) ?? 0) + 1);
  }
}
avgDocLen = chunks.length ? avgDocLen / chunks.length : 1;

function bm25Score(queryTokens: string[], chunk: Chunk): number {
  const k1 = 1.4;
  const b = 0.75;
  const tf = new Map<string, number>();
  for (const token of chunk.tokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1);
  }
  let score = 0;
  const N = chunks.length;
  for (const token of queryTokens) {
    const f = tf.get(token) ?? 0;
    if (!f) continue;
    const df = docFreq.get(token) ?? 0;
    const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
    const denom = f + k1 * (1 - b + b * (chunk.tokens.length / avgDocLen));
    score += idf * ((f * (k1 + 1)) / denom);
  }
  return score;
}

export function carinaHelpRagContext(query: string, topK = 5): string {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0 || chunks.length === 0) return '';

  const ranked = chunks
    .map((chunk) => ({ chunk, score: bm25Score(queryTokens, chunk) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  if (ranked.length === 0) return '';

  const body = ranked
    .map(
      (row, index) =>
        `[${index + 1}] ${row.chunk.title}\n${row.chunk.content.slice(0, 1200)}`,
    )
    .join('\n\n');

  return `RETRIEVED AIVA HELP CONTEXT:\n${body}`;
}

export function carinaHelpRagStats() {
  return { chunkCount: chunks.length, avgDocLen };
}
