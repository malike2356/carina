import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { initDb } from '../../memory/db.js';
import { embed, embeddingProviderStatus } from '../../memory/embeddings.js';
import {
  deleteRagSource,
  insertRagChunkWithWorkspace,
  isSourceIngested,
  listRagSources,
  searchRag,
} from '../../memory/store.js';
import { chunkAuto } from '../../memory/chunk-text.js';
import { extractFromBuffer } from '../../memory/rag-extractors.js';

const ALLOWED_EXTENSIONS = new Set(['.md', '.txt', '.pdf', '.docx']);

function parseFlag(args: string[], flag: string): string | null {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

export async function runRagCommand(args: string[]): Promise<void> {
  const action = args[0] ?? 'search';

  if (action === 'status') {
    const backend = process.env.CARINA_MEMORY_BACKEND ?? 'builtin';
    const embed = embeddingProviderStatus();
    console.log(chalk.bold('\nRAG status\n'));
    console.log(`  backend:     ${backend}`);
    console.log(`  dimensions:  ${embed.dimensions}`);
    console.log(`  active:      ${embed.active ?? 'not configured'}`);
    console.log(`  configured:  ${embed.configured.join(', ') || 'none'}`);
    console.log(`  chain:       ${embed.chain.join(' -> ') || 'none'}`);
    if (embed.override) {
      console.log(`  override:    CARINA_EMBEDDING_PROVIDER=${embed.override}`);
    }
    console.log('');
    return;
  }

  if (action === 'search') {
    const limitFlag = parseFlag(args, '--limit');
    const limit = limitFlag ? parseInt(limitFlag, 10) : 5;
    const query = args
      .slice(1)
      .filter((a) => a !== '--limit' && a !== limitFlag)
      .join(' ');
    if (!query) {
      console.error('Usage: carina rag search <query> [--limit <n>]');
      process.exit(1);
    }
    await initDb();
    const hits = await searchRag(query, limit);
    if (hits.length === 0) {
      console.log('No results found.');
      return;
    }
    for (let i = 0; i < hits.length; i++) {
      const h = hits[i];
      console.log(`\n--- Result ${i + 1} (source: ${h.source}, pack: ${h.pack}) ---`);
      console.log(h.content.slice(0, 300));
    }
    console.log('');
    return;
  }

  if (action === 'upload') {
    const filepath = args[1];
    if (!filepath) {
      console.error('Usage: carina rag upload <filepath> [--pack <name>] [--force]');
      process.exit(1);
    }
    const pack = parseFlag(args, '--pack') ?? 'custom';
    const force = hasFlag(args, '--force');

    const embedStatus = embeddingProviderStatus();
    if (!embedStatus.active) {
      console.error(
        'Embedding provider not configured. Set GOOGLE_API_KEY, VOYAGE_API_KEY, or OPENAI_API_KEY.',
      );
      process.exit(1);
    }

    const abs = path.resolve(filepath);
    const filename = path.basename(abs);
    const ext = path.extname(filename).toLowerCase();

    if (!ALLOWED_EXTENSIONS.has(ext)) {
      console.error(`File type not allowed. Accepted: ${[...ALLOWED_EXTENSIONS].join(', ')}`);
      process.exit(1);
    }

    await initDb();

    const source = `file:${filename}`;

    if (!force && (await isSourceIngested(source))) {
      console.log(`Already ingested: ${source}. Use --force to re-ingest.`);
      return;
    }

    if (force) {
      const deleted = await deleteRagSource(source, null);
      if (deleted > 0) {
        console.log(`Removed ${deleted} existing chunks for ${source}.`);
      }
    }

    const buffer = await fs.readFile(abs);
    const text = await extractFromBuffer(buffer, filename);
    const chunks = chunkAuto(text, ext === '.md' ? 'markdown' : undefined);

    let inserted = 0;
    for (const chunk of chunks.slice(0, 200)) {
      if (!chunk.trim()) continue;
      const embedding = await embed(chunk);
      await insertRagChunkWithWorkspace(source, pack, chunk, embedding, null, {
        file: abs,
        uploadedAt: new Date().toISOString(),
        type: 'file',
      });
      inserted++;
    }

    console.log(`Ingested ${inserted} chunks from ${filepath} into pack '${pack}'.`);
    return;
  }

  if (action === 'list') {
    const pack = parseFlag(args, '--pack') ?? null;
    const limitFlag = parseFlag(args, '--limit');
    const limit = limitFlag ? parseInt(limitFlag, 10) : 50;

    await initDb();
    const { sources, total } = await listRagSources(null, pack, limit, 0);

    if (sources.length === 0) {
      console.log('No RAG sources found.');
      return;
    }

    const sourceWidth = 40;
    const packWidth = 12;
    console.log(
      `\n${'SOURCE'.padEnd(sourceWidth)}  ${'PACK'.padEnd(packWidth)}  ${'CHUNKS'.padEnd(6)}  INGESTED AT`,
    );
    console.log('-'.repeat(sourceWidth + packWidth + 30));
    for (const s of sources) {
      const src = s.source.length > sourceWidth ? `...${s.source.slice(-(sourceWidth - 3))}` : s.source;
      console.log(
        `${src.padEnd(sourceWidth)}  ${s.pack.padEnd(packWidth)}  ${String(s.chunkCount).padEnd(6)}  ${s.ingestedAt}`,
      );
    }
    console.log(`\nTotal: ${total} sources`);
    if (total > limit) {
      console.log(`(showing ${limit} of ${total}; use --limit <n> to see more)`);
    }
    console.log('');
    return;
  }

  if (action === 'delete') {
    const source = args[1];
    if (!source) {
      console.error('Usage: carina rag delete <source>');
      process.exit(1);
    }
    await initDb();
    const deleted = await deleteRagSource(source, null);
    console.log(`Deleted ${deleted} chunks for source: ${source}`);
    return;
  }

  if (action === 'ingest') {
    const pack = args[1] ?? 'property-uk';
    console.log(`Run: carina ingest ${pack}`);
    return;
  }

  console.error('Usage: carina rag <search|status|upload|list|delete|ingest> [args]');
  process.exit(1);
}
