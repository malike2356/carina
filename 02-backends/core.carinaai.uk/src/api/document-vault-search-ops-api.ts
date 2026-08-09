/**
 * Document Vault search, ops, and security HTTP routes (prompt 714).
 */

import express, { type Router as ExpressRouter } from 'express';
import { getOrCreateLocalVaultService } from '../document-vault/runtime.js';
import { contentSearch } from '../document-vault/search/retriever.js';
import { assertSafeFetchUrl } from '../document-vault/security/ssrf.js';
import { requireGrant } from '../document-vault/security/grants.js';
import {
  buildDiagnostics,
  drainJobs,
  exportWorkspacePack,
  reindexItem,
  repairOrphanIndexEntries,
  retryJob,
  tempBackupRestoreRoundtrip,
} from '../document-vault/ops/index.js';
import { VaultError } from '../document-vault/errors.js';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const documentVaultSearchOpsRouter: ExpressRouter = express.Router();

function workspaceFromReq(req: express.Request): string {
  const header = String(req.header('x-carina-workspace-id') || '').trim();
  const query = String(req.query.workspaceId || req.query.workspace_id || '').trim();
  const body = req.body && typeof req.body === 'object'
    ? String((req.body as { workspaceId?: string }).workspaceId || '').trim()
    : '';
  return header || query || body;
}

function grantsFromReq(req: express.Request): string[] | null {
  const raw = req.header('x-carina-vault-grants');
  if (raw == null) return null;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function sendVaultError(res: express.Response, err: unknown): void {
  if (err instanceof VaultError) {
    const status =
      err.code === 'forbidden' || err.code === 'ssrf_blocked' ? 403
        : err.code === 'not_found' ? 404
          : err.code === 'quota' ? 413
            : 400;
    res.status(status).json({ ok: false, error: err.message, code: err.code });
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  res.status(500).json({ ok: false, error: message });
}

documentVaultSearchOpsRouter.get('/search', (req, res) => {
  try {
    const workspaceId = workspaceFromReq(req);
    if (!workspaceId) {
      res.status(400).json({ ok: false, error: 'workspaceId required' });
      return;
    }
    const q = String(req.query.q || '').trim();
    const mode = String(req.query.mode || 'metadata').trim().toLowerCase();
    const limit = Number(req.query.limit || 20);
    const svc = getOrCreateLocalVaultService();
    if (mode === 'content') {
      const result = contentSearch(svc, workspaceId, q, {
        limit,
        grants: grantsFromReq(req),
      });
      res.json(result);
      return;
    }
    requireGrant(grantsFromReq(req), 'vault.search');
    const listed = svc.searchItems(workspaceId, q, { limit });
    res.json({
      ok: true,
      query: q,
      mode: 'metadata',
      items: listed.items,
      count: listed.total,
    });
  } catch (err) {
    sendVaultError(res, err);
  }
});

documentVaultSearchOpsRouter.post('/items/:id/reindex', async (req, res) => {
  try {
    const workspaceId = workspaceFromReq(req);
    if (!workspaceId) {
      res.status(400).json({ ok: false, error: 'workspaceId required' });
      return;
    }
    requireGrant(grantsFromReq(req), 'vault.index');
    const svc = getOrCreateLocalVaultService();
    const result = await reindexItem(svc, workspaceId, String(req.params.id), { drain: true });
    res.json(result);
  } catch (err) {
    sendVaultError(res, err);
  }
});

documentVaultSearchOpsRouter.get('/ops/diagnostics', (req, res) => {
  try {
    const workspaceId = workspaceFromReq(req);
    if (!workspaceId) {
      res.status(400).json({ ok: false, error: 'workspaceId required' });
      return;
    }
    requireGrant(grantsFromReq(req), 'vault.admin');
    const svc = getOrCreateLocalVaultService();
    const quota = svc.ensureQuota(workspaceId);
    res.json(buildDiagnostics(svc, workspaceId, {
      quota: { maxBytes: quota.maxBytes, usedBytes: quota.usedBytes },
    }));
  } catch (err) {
    sendVaultError(res, err);
  }
});

documentVaultSearchOpsRouter.post('/ops/jobs/drain', async (req, res) => {
  try {
    const workspaceId = workspaceFromReq(req);
    if (!workspaceId) {
      res.status(400).json({ ok: false, error: 'workspaceId required' });
      return;
    }
    requireGrant(grantsFromReq(req), 'vault.admin');
    const limit = Number((req.body as { limit?: number })?.limit || req.query.limit || 20);
    const svc = getOrCreateLocalVaultService();
    const results = await drainJobs(svc, workspaceId, { limit });
    res.json({ ok: true, results });
  } catch (err) {
    sendVaultError(res, err);
  }
});

documentVaultSearchOpsRouter.post('/ops/jobs/:id/retry', (req, res) => {
  try {
    const workspaceId = workspaceFromReq(req);
    if (!workspaceId) {
      res.status(400).json({ ok: false, error: 'workspaceId required' });
      return;
    }
    requireGrant(grantsFromReq(req), 'vault.admin');
    const svc = getOrCreateLocalVaultService();
    const row = retryJob(svc, workspaceId, String(req.params.id));
    res.json({ ok: true, job: row });
  } catch (err) {
    sendVaultError(res, err);
  }
});

documentVaultSearchOpsRouter.post('/ops/repair/orphans', (req, res) => {
  try {
    const workspaceId = workspaceFromReq(req);
    if (!workspaceId) {
      res.status(400).json({ ok: false, error: 'workspaceId required' });
      return;
    }
    requireGrant(grantsFromReq(req), 'vault.admin');
    const dryRun = String((req.body as { dryRun?: boolean })?.dryRun ?? req.query.dryRun ?? 'true') !== 'false';
    const svc = getOrCreateLocalVaultService();
    res.json(repairOrphanIndexEntries(svc, workspaceId, { dryRun }));
  } catch (err) {
    sendVaultError(res, err);
  }
});

documentVaultSearchOpsRouter.post('/ops/backup', (req, res) => {
  try {
    const workspaceId = workspaceFromReq(req);
    if (!workspaceId) {
      res.status(400).json({ ok: false, error: 'workspaceId required' });
      return;
    }
    requireGrant(grantsFromReq(req), 'vault.admin');
    const svc = getOrCreateLocalVaultService();
    const drill = Boolean((req.body as { drill?: boolean })?.drill);
    if (drill) {
      res.json(tempBackupRestoreRoundtrip(svc, workspaceId));
      return;
    }
    const dest = mkdtempSync(join(tmpdir(), 'dv-pack-'));
    res.json(exportWorkspacePack(svc, workspaceId, dest));
  } catch (err) {
    sendVaultError(res, err);
  }
});

documentVaultSearchOpsRouter.post('/import-url', async (req, res) => {
  try {
    const workspaceId = workspaceFromReq(req);
    if (!workspaceId) {
      res.status(400).json({ ok: false, error: 'workspaceId required' });
      return;
    }
    requireGrant(grantsFromReq(req), 'vault.write');
    const body = (req.body || {}) as { url?: string; filename?: string; parentId?: string | null };
    const url = assertSafeFetchUrl(String(body.url || ''));
    const response = await fetch(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      res.status(502).json({ ok: false, error: `upstream ${response.status}` });
      return;
    }
    const buf = Buffer.from(await response.arrayBuffer());
    if (buf.byteLength > 25 * 1024 * 1024) {
      res.status(413).json({ ok: false, error: 'remote file too large' });
      return;
    }
    const { importBytesIntoVault } = await import('../document-vault/format-ops.js');
    const svc = getOrCreateLocalVaultService();
    const filename = body.filename || url.split('/').pop() || 'import.bin';
    const imported = await importBytesIntoVault(svc, {
      workspaceId,
      filename,
      bytes: buf,
      parentId: body.parentId ?? null,
      actor: { actorId: String(req.header('x-carina-actor-id') || 'url-import') },
    });
    res.json({ ok: true, item: imported.item, jobId: imported.jobId });
  } catch (err) {
    sendVaultError(res, err);
  }
});
