import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_FILE = path.join(__dirname, 'platform-knowledge.md');
const STATE_FILE = path.join(__dirname, 'platform-state.md');

let cachedKnowledge: string | null = null;
let cachedState: string | null = null;
let loading: Promise<void> | null = null;

async function readPlatformFile(filePath: string): Promise<string> {
  try {
    return await fsp.readFile(filePath, 'utf-8');
  } catch {
    return '';
  }
}

export async function loadPlatformKnowledge(): Promise<string> {
  await preloadPlatformKnowledge();
  return cachedKnowledge ?? '';
}

export async function loadPlatformState(): Promise<string> {
  await preloadPlatformKnowledge();
  return cachedState ?? '';
}

/** Call once during server bootstrap before handling requests. */
export async function preloadPlatformKnowledge(): Promise<void> {
  if (cachedKnowledge !== null) return;
  if (!loading) {
    loading = Promise.all([
      readPlatformFile(KNOWLEDGE_FILE),
      readPlatformFile(STATE_FILE),
    ]).then(([knowledge, state]) => {
      cachedKnowledge = knowledge;
      cachedState = state;
    });
  }
  await loading;
}

export function buildPlatformKnowledgeContext(): string {
  const parts: string[] = [];
  const knowledge = (cachedKnowledge ?? '').trim();
  const state = (cachedState ?? '').trim();
  if (knowledge) {
    parts.push(`Platform scope (Carina monorepo, products, and operator boundaries):\n${knowledge}`);
  }
  if (state) {
    parts.push(`Platform state (active projects and key documents):\n${state}`);
  }
  return parts.join('\n\n');
}
