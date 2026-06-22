import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from '../memory/db.js';
import { embed } from '../memory/embeddings.js';
import { isSourceIngested, insertRagChunk } from '../memory/store.js';
import { loadPackSkills } from './index.js';

const CHARS_PER_CHUNK = 2000;
const ARCHIVE_DIRS = ['docs', 'architecture'];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORE_PACKAGE_ROOT = path.resolve(__dirname, '../../..');
const ARCHIVE_ROOT = path.join(CORE_PACKAGE_ROOT, 'archive/property-saas-spec');

function parseArgs(): { pack: string; skillsOnly: boolean } {
  const args = process.argv.slice(2);
  let pack = 'property-uk';
  let skillsOnly = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--pack' && args[i + 1]) {
      pack = args[++i];
    }
    if (args[i] === '--skills-only') {
      skillsOnly = true;
    }
  }

  return { pack, skillsOnly };
}

async function discoverBrainKnowledgeDirs(brainRoot: string): Promise<string[]> {
  const dirs: string[] = [];
  let entries;
  try {
    entries = await fs.readdir(brainRoot, { withFileTypes: true });
  } catch {
    return dirs;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const knowledgeDir = path.join(brainRoot, entry.name, 'knowledge');
    try {
      await fs.access(knowledgeDir);
      dirs.push(knowledgeDir);
    } catch {
      // no knowledge tree for this domain pack
    }
  }
  return dirs;
}

async function walkMdFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkMdFiles(full));
    } else if (entry.name.endsWith('.md')) {
      files.push(full);
    }
  }
  return files;
}

function chunkMarkdown(content: string): string[] {
  const sections = content.split(/(?=^#{1,3} )/m).filter((s) => s.trim());
  const chunks: string[] = [];
  let buffer = '';

  for (const section of sections) {
    if ((buffer + section).length > CHARS_PER_CHUNK && buffer) {
      chunks.push(buffer.trim());
      buffer = section;
    } else {
      buffer += (buffer ? '\n' : '') + section;
    }
  }

  if (buffer.trim()) chunks.push(buffer.trim());

  if (chunks.length === 0 && content.trim()) {
    const paragraphs = content.split(/\n\n+/);
    for (const para of paragraphs) {
      if ((buffer + para).length > CHARS_PER_CHUNK && buffer) {
        chunks.push(buffer.trim());
        buffer = para;
      } else {
        buffer += (buffer ? '\n\n' : '') + para;
      }
    }
    if (buffer.trim()) chunks.push(buffer.trim());
  }

  return chunks;
}

async function ingestFile(filePath: string, pack: string): Promise<number> {
  const source = path.relative(ARCHIVE_ROOT, filePath);
  if (await isSourceIngested(source)) {
    console.log(`Skipping ${source} (already ingested)`);
    return 0;
  }

  const content = await fs.readFile(filePath, 'utf-8');
  const chunks = chunkMarkdown(content);
  let inserted = 0;

  for (const chunk of chunks) {
    const embedding = await embed(chunk);
    await insertRagChunk(source, pack, chunk, embedding, { file: source });
    inserted++;
  }

  console.log(`Ingesting ${inserted} chunks from ${source}`);
  return inserted;
}

export async function ingestPackDirectory(pack: string, dir: string): Promise<number> {
  const files = await walkMdFiles(dir);
  let total = 0;
  for (const file of files) {
    const source = `${pack}:${path.relative(dir, file)}`;
    if (await isSourceIngested(source)) continue;
    const content = await fs.readFile(file, 'utf-8');
    const chunks = chunkMarkdown(content);
    for (const chunk of chunks) {
      const embedding = await embed(chunk);
      await insertRagChunk(source, pack, chunk, embedding, { file: source });
      total++;
    }
  }
  return total;
}

export async function runIngestion(): Promise<void> {
  const { pack, skillsOnly } = parseArgs();
  await initDb();

  try {
    const skillsLoaded = await loadPackSkills(pack);
    console.log(`Loaded ${skillsLoaded} pre-built skills for pack: ${pack}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`Skipping pack skills for ${pack}: ${message}`);
  }

  if (skillsOnly) {
    console.log('Skills-only mode; skipping RAG ingest.');
    return;
  }

  let total = 0;
  for (const subdir of ARCHIVE_DIRS) {
    const dir = path.join(ARCHIVE_ROOT, subdir);
    const files = await walkMdFiles(dir);
    for (const file of files) {
      total += await ingestFile(file, pack);
    }
  }

  if (total === 0) {
    const brainRoot = path.join(CORE_PACKAGE_ROOT, 'brain');
    const knowledgeDirs = await discoverBrainKnowledgeDirs(brainRoot);
    if (knowledgeDirs.length === 0) {
      console.warn('No archive markdown and no brain knowledge directories found.');
    } else {
      console.log(`Ingesting brain knowledge from ${knowledgeDirs.length} domain pack(s)...`);
      for (const dir of knowledgeDirs) {
        const inserted = await ingestPackDirectory(pack, dir);
        total += inserted;
        if (inserted > 0) {
          console.log(`Ingested ${inserted} chunks from ${path.basename(path.dirname(dir))}`);
        }
      }
    }
  }

  console.log(`Ingestion complete. ${total} RAG chunks inserted.`);
}

const isMain = process.argv[1]?.includes('ingestion');
if (isMain) {
  runIngestion().catch((err) => {
    console.error('Ingestion failed:', err);
    process.exit(1);
  });
}
