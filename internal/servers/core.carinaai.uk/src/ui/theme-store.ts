import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveCarinaHome } from '../config/paths.js';

export interface WorkspaceTheme {
  name: string;
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  border: string;
  createdAt: string;
}

interface ThemeIndex {
  version: number;
  themes: WorkspaceTheme[];
}

function indexPath(): string {
  return path.join(resolveCarinaHome(), 'themes.json');
}

async function readIndex(): Promise<ThemeIndex> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw) as ThemeIndex;
    if (!Array.isArray(parsed.themes)) return { version: 1, themes: [] };
    return parsed;
  } catch {
    return { version: 1, themes: [] };
  }
}

async function writeIndex(index: ThemeIndex): Promise<void> {
  await fs.mkdir(resolveCarinaHome(), { recursive: true });
  await fs.writeFile(indexPath(), JSON.stringify(index, null, 2), 'utf8');
}

export async function listThemes(): Promise<WorkspaceTheme[]> {
  const index = await readIndex();
  return index.themes;
}

export async function saveTheme(theme: WorkspaceTheme): Promise<WorkspaceTheme> {
  const index = await readIndex();
  const existing = index.themes.findIndex((t) => t.name === theme.name);
  if (existing >= 0) index.themes[existing] = theme;
  else index.themes.unshift(theme);
  index.themes = index.themes.slice(0, 32);
  await writeIndex(index);
  return theme;
}

export async function deleteTheme(name: string): Promise<boolean> {
  const index = await readIndex();
  const before = index.themes.length;
  index.themes = index.themes.filter((t) => t.name !== name);
  if (index.themes.length === before) return false;
  await writeIndex(index);
  return true;
}
