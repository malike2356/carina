import type { Tool } from '../types/index.js';
import { embed } from '../memory/embeddings.js';
import { resolveModelFamily } from '../brain/prompt-overlays.js';

type ToolEmbeddingEntry = {
  text: string;
  vector: number[];
};

const cache = new Map<string, ToolEmbeddingEntry>();

function toolEmbeddingKey(tool: Tool): string {
  return `${tool.name}::${tool.description ?? ''}`;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

function toolEmbeddingText(tool: Tool): string {
  const desc = tool.description?.trim() ?? '';
  return desc ? `${tool.name}: ${desc}` : tool.name;
}

async function embedTool(tool: Tool): Promise<number[]> {
  const key = toolEmbeddingKey(tool);
  const cached = cache.get(key);
  if (cached) return cached.vector;

  const text = toolEmbeddingText(tool);
  const vector = await embed(text);
  cache.set(key, { text, vector });
  return vector;
}

export function clearToolEmbeddingCacheForTests(): void {
  cache.clear();
}

export function embeddingToolSelectMinTools(): number {
  const raw = Number(process.env.CARINA_TOOL_EMBED_MIN_TOOLS ?? '18');
  return Number.isFinite(raw) && raw > 0 ? raw : 18;
}

export function embeddingToolSelectTopK(): number {
  const raw = Number(process.env.CARINA_TOOL_EMBED_TOP_K ?? '24');
  return Number.isFinite(raw) && raw > 0 ? raw : 24;
}

export function embeddingToolSelectContextMax(): number {
  const raw = Number(process.env.CARINA_TOOL_EMBED_CONTEXT_MAX ?? '128000');
  return Number.isFinite(raw) && raw > 0 ? raw : 128_000;
}

export function shouldUseEmbeddingToolSelect(opts: {
  toolCount: number;
  contextWindow?: number;
  provider?: string;
  model?: string;
}): boolean {
  if (process.env.CARINA_TOOL_EMBED_SELECT === 'false') return false;
  if (opts.toolCount < embeddingToolSelectMinTools()) return false;
  if (process.env.CARINA_TOOL_EMBED_SELECT === 'true') return true;

  const family = opts.provider && opts.model
    ? resolveModelFamily(opts.provider, opts.model)
    : null;
  if (family === 'local') return true;

  const window = opts.contextWindow ?? embeddingToolSelectContextMax();
  return window <= embeddingToolSelectContextMax();
}

export async function selectToolsByEmbedding(opts: {
  tools: Tool[];
  query: string;
  topK?: number;
  alwaysInclude?: string[];
}): Promise<Tool[]> {
  const { tools, query } = opts;
  const topK = opts.topK ?? embeddingToolSelectTopK();
  const alwaysInclude = new Set(opts.alwaysInclude ?? []);

  if (tools.length <= topK) return tools;

  const queryVector = await embed(query);
  if (queryVector.length === 0) return tools.slice(0, topK);

  const scored = await Promise.all(tools.map(async (tool) => {
    const vector = await embedTool(tool);
    const score = cosineSimilarity(queryVector, vector);
    return { tool, score };
  }));

  scored.sort((a, b) => b.score - a.score);

  const selected = new Map<string, Tool>();
  for (const name of alwaysInclude) {
    const tool = tools.find((t) => t.name === name);
    if (tool) selected.set(tool.name, tool);
  }

  for (const entry of scored) {
    if (selected.size >= topK) break;
    selected.set(entry.tool.name, entry.tool);
  }

  return [...selected.values()];
}
