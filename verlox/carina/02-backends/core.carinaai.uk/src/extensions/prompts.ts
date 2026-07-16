import fs from 'fs/promises';
import path from 'path';
import { CARINA_EXTENSION_RESOURCES_DIR } from '../config/paths.js';
import { extensionsRuntimeEnabled } from './contributions.js';
import { listEnabledExtensionIds } from './store.js';

let cachedSuffix = '';

export function getExtensionPromptSuffix(): string {
  return cachedSuffix;
}

export function clearExtensionPromptSuffix(): void {
  cachedSuffix = '';
}

async function readMarkdownFiles(dir: string): Promise<string[]> {
  const chunks: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      chunks.push(...(await readMarkdownFiles(full)));
    } else if (/\.(md|txt)$/i.test(entry.name)) {
      const text = (await fs.readFile(full, 'utf-8')).trim();
      if (text) chunks.push(text);
    }
  }
  return chunks;
}

export async function loadExtensionPromptSuffixes(): Promise<number> {
  clearExtensionPromptSuffix();
  if (!extensionsRuntimeEnabled()) return 0;

  const ids = await listEnabledExtensionIds();
  const sections: string[] = [];

  for (const id of ids) {
    const promptsDir = path.join(CARINA_EXTENSION_RESOURCES_DIR, id, 'prompts');
    try {
      await fs.access(promptsDir);
    } catch {
      continue;
    }
    const parts = await readMarkdownFiles(promptsDir);
    if (parts.length > 0) {
      sections.push(`Extension "${id}":\n${parts.join('\n\n')}`);
    }
  }

  if (sections.length > 0) {
    cachedSuffix = sections.join('\n\n---\n\n');
  }
  return sections.length;
}
