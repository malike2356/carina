import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Ops RAG: Full codebase indexing with BM25 retrieval
// Indexes all .ts, .ejs, .md, .css files in the ops directory.
// Chunks into ~400-token segments with overlap.
// Retrieves top-K relevant chunks per query using BM25 scoring.
// ---------------------------------------------------------------------------

export interface RagChunk {
  id: number;
  filePath: string;
  fileName: string;
  lineStart: number;
  lineEnd: number;
  content: string;
  tokens: string[];
  fileType: string;
}

interface BM25Index {
  chunks: RagChunk[];
  docFreq: Map<string, number>;
  avgDocLen: number;
  totalDocs: number;
  indexedAt: string;
  fileCount: number;
}

const CHUNK_SIZE = 40; // lines per chunk
const CHUNK_OVERLAP = 8; // overlap lines
const MAX_FILE_SIZE = 100_000; // skip files larger than 100KB
const INDEXED_EXTENSIONS = ['.ts', '.ejs', '.md', '.css', '.js'];
const SKIP_DIRS = ['node_modules', 'dist', '.git', 'coverage', '.turbo'];

let index: BM25Index | null = null;

// ---------------------------------------------------------------------------
// Tokenization
// ---------------------------------------------------------------------------

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_\-/.]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && t.length < 60);
}

// ---------------------------------------------------------------------------
// File discovery and chunking
// ---------------------------------------------------------------------------

function discoverFiles(rootDir: string): string[] {
  const results: string[] = [];

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (SKIP_DIRS.includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (INDEXED_EXTENSIONS.includes(ext)) {
          try {
            const stat = fs.statSync(full);
            if (stat.size <= MAX_FILE_SIZE) results.push(full);
          } catch { /* skip */ }
        }
      }
    }
  }

  walk(rootDir);
  return results;
}

function chunkFile(filePath: string, rootDir: string): RagChunk[] {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return [];
  }

  const lines = content.split('\n');
  const relativePath = path.relative(rootDir, filePath);
  const fileName = path.basename(filePath);
  const ext = path.extname(fileName).toLowerCase();
  const chunks: RagChunk[] = [];

  for (let start = 0; start < lines.length; start += CHUNK_SIZE - CHUNK_OVERLAP) {
    const end = Math.min(start + CHUNK_SIZE, lines.length);
    const chunkLines = lines.slice(start, end);
    const chunkContent = chunkLines.join('\n');

    if (chunkContent.trim().length < 20) continue;

    chunks.push({
      id: 0, // assigned later
      filePath: relativePath,
      fileName,
      lineStart: start + 1,
      lineEnd: end,
      content: chunkContent,
      tokens: tokenize(relativePath + ' ' + chunkContent),
      fileType: ext.slice(1),
    });

    if (end >= lines.length) break;
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// BM25 index building
// ---------------------------------------------------------------------------

function buildIndex(rootDir: string): BM25Index {
  const files = discoverFiles(rootDir);
  const allChunks: RagChunk[] = [];

  for (const file of files) {
    const fileChunks = chunkFile(file, rootDir);
    allChunks.push(...fileChunks);
  }

  // Assign IDs
  for (let i = 0; i < allChunks.length; i++) {
    allChunks[i].id = i;
  }

  // Compute document frequencies
  const docFreq = new Map<string, number>();
  for (const chunk of allChunks) {
    const seen = new Set(chunk.tokens);
    for (const token of seen) {
      docFreq.set(token, (docFreq.get(token) || 0) + 1);
    }
  }

  // Average document length
  const totalTokens = allChunks.reduce((sum, c) => sum + c.tokens.length, 0);
  const avgDocLen = allChunks.length > 0 ? totalTokens / allChunks.length : 1;

  return {
    chunks: allChunks,
    docFreq,
    avgDocLen,
    totalDocs: allChunks.length,
    indexedAt: new Date().toISOString(),
    fileCount: files.length,
  };
}

// ---------------------------------------------------------------------------
// BM25 retrieval
// ---------------------------------------------------------------------------

const K1 = 1.5;
const B = 0.75;

function bm25Score(queryTokens: string[], chunk: RagChunk, idx: BM25Index): number {
  const docLen = chunk.tokens.length;
  let score = 0;

  // Term frequency map for this chunk
  const tf = new Map<string, number>();
  for (const token of chunk.tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }

  for (const qt of queryTokens) {
    const df = idx.docFreq.get(qt) || 0;
    if (df === 0) continue;

    const idf = Math.log((idx.totalDocs - df + 0.5) / (df + 0.5) + 1);
    const termFreq = tf.get(qt) || 0;
    const tfNorm = (termFreq * (K1 + 1)) / (termFreq + K1 * (1 - B + B * (docLen / idx.avgDocLen)));
    score += idf * tfNorm;
  }

  // Boost for filename match
  const fileTokens = tokenize(chunk.fileName);
  for (const qt of queryTokens) {
    if (fileTokens.includes(qt)) score += 2.0;
  }

  return score;
}

export function search(query: string, topK: number = 8): RagChunk[] {
  if (!index || index.chunks.length === 0) return [];

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const scored = index.chunks.map((chunk) => ({
    chunk,
    score: bm25Score(queryTokens, chunk, index!),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored
    .slice(0, topK)
    .filter((s) => s.score > 0.5)
    .map((s) => s.chunk);
}

// ---------------------------------------------------------------------------
// Format results for LLM context
// ---------------------------------------------------------------------------

export function formatChunksForContext(chunks: RagChunk[]): string {
  if (chunks.length === 0) return '';

  const sections = chunks.map((chunk) => {
    return `FILE: ${chunk.filePath} (lines ${chunk.lineStart}-${chunk.lineEnd}, ${chunk.fileType})\n${chunk.content}`;
  });

  return '--- RELEVANT CODE FROM OPS CODEBASE (RAG) ---\n\n' + sections.join('\n\n---\n\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getOpsRoot(): string {
  const moduleDir = path.dirname(new URL(import.meta.url).pathname);
  const root = path.basename(moduleDir) === 'lib'
    ? path.dirname(moduleDir)
    : moduleDir;
  return root;
}

export function indexOpsCodebase(): { fileCount: number; chunkCount: number; indexedAt: string } {
  const root = getOpsRoot();
  index = buildIndex(root);
  return {
    fileCount: index.fileCount,
    chunkCount: index.totalDocs,
    indexedAt: index.indexedAt,
  };
}

export function getIndexStats(): { indexed: boolean; fileCount: number; chunkCount: number; indexedAt: string | null } {
  if (!index) return { indexed: false, fileCount: 0, chunkCount: 0, indexedAt: null };
  return {
    indexed: true,
    fileCount: index.fileCount,
    chunkCount: index.totalDocs,
    indexedAt: index.indexedAt,
  };
}

export function ragQuery(userQuestion: string, topK: number = 6): string {
  const chunks = search(userQuestion, topK);
  return formatChunksForContext(chunks);
}
