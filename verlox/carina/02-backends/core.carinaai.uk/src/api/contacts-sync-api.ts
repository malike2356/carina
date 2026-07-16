import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import { Router, type IRouter } from 'express';
import { syncGoogleContacts } from '../integrations/contacts-google.js';
import { importContactsFromCsv } from '../integrations/contacts-csv.js';

export const contactsSyncRouter: IRouter = Router();

function contactsDir(): string {
  const home = process.env.CARINA_HOME ?? path.join(os.homedir(), '.carina');
  return path.join(home, 'profiles', 'contacts');
}

contactsSyncRouter.post('/google', async (req, res) => {
  const { accessToken, workspaceId } = (req.body ?? {}) as Record<string, unknown>;
  if (typeof accessToken !== 'string' || !accessToken.trim()) {
    res.status(400).json({ error: 'accessToken is required' });
    return;
  }
  try {
    const result = await syncGoogleContacts(accessToken.trim(), workspaceId as string | undefined);
    res.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

contactsSyncRouter.post('/csv', async (req, res) => {
  const { csvContent, filename, workspaceId } = (req.body ?? {}) as Record<string, unknown>;
  if (typeof csvContent !== 'string' || !csvContent.trim()) {
    res.status(400).json({ error: 'csvContent is required' });
    return;
  }
  const name = typeof filename === 'string' && filename.trim() ? filename.trim() : 'contacts.csv';
  try {
    const result = await importContactsFromCsv(csvContent, name, workspaceId as string | undefined);
    res.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

contactsSyncRouter.get('/status', async (_req, res) => {
  const dir = contactsDir();
  if (!fsSync.existsSync(dir)) {
    res.json({ sources: [] });
    return;
  }

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const sources: Array<{ name: string; file: string; count: number; lastModified: string | null }> = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      const fullPath = path.join(dir, entry.name);
      try {
        const raw = await fs.readFile(fullPath, 'utf8');
        const data = JSON.parse(raw) as unknown;
        const count = Array.isArray(data) ? data.length : (data as Record<string, unknown[]>).contacts?.length ?? 0;
        const stat = await fs.stat(fullPath);
        sources.push({
          name: entry.name.replace(/\.json$/, ''),
          file: entry.name,
          count,
          lastModified: stat.mtime.toISOString(),
        });
      } catch {
        sources.push({ name: entry.name.replace(/\.json$/, ''), file: entry.name, count: 0, lastModified: null });
      }
    }

    res.json({ sources });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});
