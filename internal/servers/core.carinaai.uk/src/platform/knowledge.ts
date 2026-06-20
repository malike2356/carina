import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_FILE = path.join(__dirname, 'platform-knowledge.md');

let cached: string | null = null;
let loading: Promise<string> | null = null;

export async function loadPlatformKnowledge(): Promise<string> {
  if (cached) return cached;
  if (!loading) {
    loading = fsp.readFile(KNOWLEDGE_FILE, 'utf-8').then(
      (text) => {
        cached = text;
        return text;
      },
      () => {
        cached = '';
        return '';
      },
    );
  }
  return loading;
}

/** Call once during server bootstrap before handling requests. */
export async function preloadPlatformKnowledge(): Promise<void> {
  await loadPlatformKnowledge();
}

export function buildPlatformKnowledgeContext(): string {
  const body = (cached ?? '').trim();
  if (!body) return '';
  return `Platform scope (Carina monorepo, products, and operator boundaries):\n${body}`;
}
