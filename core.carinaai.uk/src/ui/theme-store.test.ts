import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('theme-store', () => {
  let tmpHome: string;
  const prevHome = process.env.CARINA_HOME;

  beforeEach(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-theme-store-'));
    process.env.CARINA_HOME = tmpHome;
    vi.resetModules();
  });

  afterEach(async () => {
    if (prevHome === undefined) delete process.env.CARINA_HOME;
    else process.env.CARINA_HOME = prevHome;
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it('persists themes to disk and lists them after reload', async () => {
    const { saveTheme, listThemes, deleteTheme } = await import('./theme-store.js');
    await saveTheme({
      name: 'deep ocean',
      bg: '#040d1a',
      surface: '#061428',
      text: '#e4e4e9',
      muted: '#575768',
      accent: '#00d4ff',
      border: 'rgba(255,255,255,0.07)',
      createdAt: new Date().toISOString(),
    });

    vi.resetModules();
    const reloaded = await import('./theme-store.js');
    const themes = await reloaded.listThemes();
    expect(themes.some((t) => t.name === 'deep ocean')).toBe(true);

    const deleted = await reloaded.deleteTheme('deep ocean');
    expect(deleted).toBe(true);
    expect((await reloaded.listThemes()).length).toBe(0);
  });

  it('updates an existing theme by name', async () => {
    const { saveTheme, listThemes } = await import('./theme-store.js');
    const base = {
      name: 'sunset',
      bg: '#1a0a00',
      surface: '#1a0a00',
      text: '#ffe8d6',
      muted: '#8a6040',
      accent: '#ff6b35',
      border: 'rgba(255,255,255,0.07)',
      createdAt: new Date().toISOString(),
    };
    await saveTheme(base);
    await saveTheme({ ...base, accent: '#ff8844' });
    const themes = await listThemes();
    expect(themes.find((t) => t.name === 'sunset')?.accent).toBe('#ff8844');
  });
});
