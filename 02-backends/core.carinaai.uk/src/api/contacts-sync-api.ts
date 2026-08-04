import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import { Router, type IRouter, type Request } from 'express';
import {
  createGoogleContact,
  deleteGoogleContact,
  syncGoogleContacts,
  updateGoogleContact,
} from '../integrations/contacts-google.js';
import { importContactsFromCsv } from '../integrations/contacts-csv.js';
import {
  deleteContactFromLocalStore,
  findContactById,
  loadAllContacts,
  manualContactsFile,
  rootContactsFile,
  upsertManualContact,
} from '../profiles/contacts.js';
import {
  getWorkspaceGoogleCredentials,
  workspaceHasGoogleAccount,
} from '../workers/product-tools/accounts.js';
import {
  ensureDefaultContactsSyncSchedule,
  getContactsSyncSchedule,
  upsertContactsSyncSchedule,
} from '../contacts/contacts-sync-schedule-store.js';
import {
  getScheduleStatus,
  runWorkspaceContactsSync,
} from '../contacts/contacts-sync-runner.js';

export const contactsSyncRouter: IRouter = Router();

function contactsDir(): string {
  const home = process.env.CARINA_HOME ?? path.join(os.homedir(), '.carina');
  return path.join(home, 'profiles', 'contacts');
}

function workspaceIdFromRequest(req: Request, bodyWorkspaceId?: unknown): string | undefined {
  if (typeof bodyWorkspaceId === 'string' && bodyWorkspaceId.trim()) {
    return bodyWorkspaceId.trim();
  }
  const header = req.headers['x-workspace-id'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  if (Array.isArray(header) && typeof header[0] === 'string' && header[0].trim()) {
    return header[0].trim();
  }
  return undefined;
}

async function resolveGoogleSyncAuth(opts: {
  accessToken?: string;
  workspaceId?: string;
}): Promise<{ accessToken?: string; refreshToken?: string; error?: string; code?: string }> {
  const accessToken = opts.accessToken?.trim() ?? '';
  if (accessToken) return { accessToken };

  if (opts.workspaceId) {
    const account = await getWorkspaceGoogleCredentials(opts.workspaceId).catch(() => null);
    if (account?.credentials.refresh_token) {
      return { refreshToken: account.credentials.refresh_token };
    }
    if (account?.credentials.access_token) {
      return { accessToken: account.credentials.access_token };
    }
    // Never fall back to host env tokens for a specific Aiva workspace.
    return {
      error: 'Connect Google in Tools first (Gmail, Drive, or Calendar), then sync contacts.',
      code: 'google_not_connected',
    };
  }

  if (
    process.env.GOOGLE_REFRESH_TOKEN?.trim()
    || process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim()
  ) {
    return {
      refreshToken:
        process.env.GOOGLE_REFRESH_TOKEN?.trim()
        || process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim(),
    };
  }

  return {
    error: 'Connect Google in Tools first (Gmail, Drive, or Calendar), then sync contacts.',
    code: 'google_not_connected',
  };
}

contactsSyncRouter.post('/google', async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const workspaceId = workspaceIdFromRequest(req, body.workspaceId);
  const accessToken = typeof body.accessToken === 'string' ? body.accessToken.trim() : '';

  try {
    const auth = await resolveGoogleSyncAuth({ accessToken, workspaceId });
    if (auth.error) {
      res.status(400).json({ error: auth.error, code: auth.code });
      return;
    }

    const result = await syncGoogleContacts(auth.accessToken ?? '', workspaceId, {
      refreshToken: auth.refreshToken,
    });
    if (workspaceId) {
      await ensureDefaultContactsSyncSchedule(workspaceId).catch(() => undefined);
    }
    if (result.errors.length > 0 && result.imported === 0) {
      const raw = result.errors[0] ?? 'Google sync failed';
      const revoked = /invalid_grant|expired|revoked/i.test(raw);
      res.status(400).json({
        error: revoked
          ? 'Google access expired or was revoked. Reconnect Google in Tools, then sync again.'
          : raw,
        code: revoked ? 'google_reauth_required' : undefined,
        imported: result.imported,
        skipped: result.skipped,
        errors: result.errors,
      });
      return;
    }
    res.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

contactsSyncRouter.post('/google/contact', async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const workspaceId = workspaceIdFromRequest(req, body.workspaceId);
    if (!workspaceId) {
      res.status(400).json({ error: 'x-workspace-id is required', code: 'workspace_required' });
      return;
    }
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const auth = await resolveGoogleSyncAuth({ workspaceId });
    if (auth.error) {
      res.status(400).json({ error: auth.error, code: auth.code });
      return;
    }
    const result = await createGoogleContact({
      name,
      role: typeof body.role === 'string' ? body.role : undefined,
      email: typeof body.email === 'string' ? body.email : undefined,
      phone: typeof body.phone === 'string' ? body.phone : undefined,
    });
    if (!result.ok || !result.contact) {
      res.status(500).json({ error: result.error ?? 'Failed to create Google contact' });
      return;
    }
    await syncGoogleContacts(auth.accessToken ?? '', workspaceId, {
      refreshToken: auth.refreshToken,
    }).catch(() => undefined);
    res.status(201).json({ ok: true, contact: result.contact });
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

contactsSyncRouter.get('/', async (req, res) => {
  try {
    const workspaceId = workspaceIdFromRequest(req);
    if (!workspaceId && (process.env.HOSTED_MODE === 'true' || process.env.CARINA_OPS_PRODUCT_ENABLED === 'true')) {
      res.status(400).json({ error: 'x-workspace-id is required' });
      return;
    }
    const contacts = await loadAllContacts(workspaceId);
    const sources = await listContactSources(workspaceId);
    res.json({
      contacts,
      sources,
      counts: {
        contacts: contacts.length,
        manual: contacts.filter((contact) => contact.source === 'manual').length,
        google: contacts.filter((contact) => contact.source === 'google').length,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

contactsSyncRouter.post('/manual', async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const contact = await upsertManualContact({
      name,
      role: typeof body.role === 'string' ? body.role : undefined,
      email: typeof body.email === 'string' ? body.email : undefined,
      phone: typeof body.phone === 'string' ? body.phone : undefined,
      whatsapp: typeof body.whatsapp === 'string' ? body.whatsapp : undefined,
      telegram: typeof body.telegram === 'string' ? body.telegram : undefined,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
      tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
    });
    res.status(201).json({ ok: true, contact });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

contactsSyncRouter.get('/status', async (req, res) => {
  const workspaceId = workspaceIdFromRequest(req);
  const dir = contactsDir();
  let configured = Boolean(resolveGoogleContactsConfigured());
  if (!configured && workspaceId) {
    configured = await workspaceHasGoogleAccount(workspaceId).catch(() => false);
  }

  if (!fsSync.existsSync(dir)) {
    res.json({
      sources: [],
      configured,
    });
    return;
  }

  try {
    const sources = await listContactSources();
    const schedule = workspaceId
      ? await getContactsSyncSchedule(workspaceId).catch(() => null)
      : null;
    res.json({
      sources,
      configured,
      manualFile: manualContactsFile(),
      rootFile: rootContactsFile(),
      schedule,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

contactsSyncRouter.get('/schedule', async (req, res) => {
  const workspaceId = workspaceIdFromRequest(req);
  if (!workspaceId) {
    res.status(400).json({ error: 'X-Workspace-Id is required' });
    return;
  }
  try {
    if (await workspaceHasGoogleAccount(workspaceId).catch(() => false)) {
      await ensureDefaultContactsSyncSchedule(workspaceId).catch(() => undefined);
    }
    const schedule = await getScheduleStatus(workspaceId);
    res.json(schedule);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

contactsSyncRouter.post('/schedule', async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const workspaceId = workspaceIdFromRequest(req, body.workspaceId);
  if (!workspaceId) {
    res.status(400).json({ error: 'X-Workspace-Id is required' });
    return;
  }
  try {
    const schedule = await upsertContactsSyncSchedule(workspaceId, {
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
      timesPerDay: body.timesPerDay != null ? Number(body.timesPerDay) : undefined,
      timezone: typeof body.timezone === 'string' ? body.timezone : undefined,
    });
    const configured = await workspaceHasGoogleAccount(workspaceId).catch(() => false);
    res.json({ ...schedule, configured });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

contactsSyncRouter.post('/schedule/run', async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const workspaceId = workspaceIdFromRequest(req, body.workspaceId);
  if (!workspaceId) {
    res.status(400).json({ error: 'X-Workspace-Id is required' });
    return;
  }
  try {
    const outcome = await runWorkspaceContactsSync(workspaceId);
    if (!outcome.ok) {
      res.status(400).json({
        error: outcome.error ?? 'Google sync failed',
        imported: outcome.imported,
        skipped: outcome.skipped,
      });
      return;
    }
    const schedule = await getScheduleStatus(workspaceId);
    res.json({
      ok: true,
      imported: outcome.imported,
      skipped: outcome.skipped,
      schedule,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

contactsSyncRouter.patch('/:id', async (req, res) => {
  try {
    const id = String(req.params.id ?? '').trim();
    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const workspaceId = workspaceIdFromRequest(req, body.workspaceId);
    const current = await findContactById(id);
    if (!current) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }

    if (current.source === 'google') {
      const updated = await updateGoogleContact({
        id,
        name: typeof body.name === 'string' ? body.name : current.name,
        role: typeof body.role === 'string' ? body.role : current.role,
        email: typeof body.email === 'string' ? body.email : current.email,
        phone: typeof body.phone === 'string' ? body.phone : current.phone,
      });
      if (!updated.ok) {
        res.status(500).json({ error: updated.error ?? 'Failed to update Google contact' });
        return;
      }
      await syncGoogleContacts('', workspaceId).catch(() => undefined);
      res.json({ ok: true, contact: updated.contact });
      return;
    }

    const local = await upsertManualContact({
      id,
      name: typeof body.name === 'string' ? body.name : current.name,
      role: typeof body.role === 'string' ? body.role : current.role,
      email: typeof body.email === 'string' ? body.email : current.email,
      phone: typeof body.phone === 'string' ? body.phone : current.phone,
      whatsapp: typeof body.whatsapp === 'string' ? body.whatsapp : current.whatsapp,
      telegram: typeof body.telegram === 'string' ? body.telegram : current.telegram,
      notes: typeof body.notes === 'string' ? body.notes : current.notes,
      tags: Array.isArray(body.tags) ? body.tags.map(String) : current.tags,
    });
    res.json({ ok: true, contact: local });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

contactsSyncRouter.delete('/:id', async (req, res) => {
  try {
    const id = String(req.params.id ?? '').trim();
    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }
    const workspaceId = workspaceIdFromRequest(req);
    const current = await findContactById(id);
    if (!current) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }
    if (current.source === 'google') {
      const deleted = await deleteGoogleContact(current.resourceName ?? current.id);
      if (!deleted.ok) {
        res.status(500).json({ error: deleted.error ?? 'Failed to delete Google contact' });
        return;
      }
      await syncGoogleContacts('', workspaceId).catch(() => undefined);
      res.json({ ok: true });
      return;
    }
    const deleted = await deleteContactFromLocalStore(id);
    if (!deleted) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

function resolveGoogleContactsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_REFRESH_TOKEN?.trim()
    || process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim()
    || process.env.GOOGLE_CLIENT_ID?.trim()
    || process.env.GOOGLE_OAUTH_CLIENT_ID?.trim(),
  );
}

async function listContactSources(
  workspaceId?: string,
): Promise<Array<{ name: string; file: string; count: number; lastModified: string | null }>> {
  const dir = contactsDir();
  if (!fsSync.existsSync(dir)) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const prefix = workspaceId?.trim().slice(0, 16).toLowerCase() ?? '';
  const sources: Array<{ name: string; file: string; count: number; lastModified: string | null }> = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    if (entry.name.toLowerCase() === 'enrichments.json') continue;
    if (prefix) {
      const lower = entry.name.toLowerCase();
      const allowed =
        lower === `google-${prefix}.json`
        || lower === `csv-${prefix}.json`
        || lower === `manual-${prefix}.json`
        || lower === `enrichments-${prefix}.json`
        || lower === `google-${prefix.slice(0, 16)}.json`
        || lower === `csv-${prefix.slice(0, 16)}.json`
        || lower === `manual-${prefix.slice(0, 16)}.json`;
      if (!allowed) continue;
    }
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
  return sources;
}
