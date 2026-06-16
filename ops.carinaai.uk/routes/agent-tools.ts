import { Router } from 'express';
import {
  getAllCategories,
  getTenantOverrides,
  getToolCallLog,
  updateCategory,
  upsertTenantOverride,
} from '../lib/tool-config.js';

export const agentToolsRouter = Router();

function parseBoolean(value: unknown): boolean | undefined {
  if (value === 'inherit') return undefined;
  if (value === 'true' || value === 'on') return true;
  if (value === 'false') return false;
  return undefined;
}

function parseNumber(value: unknown, min: number, max: number): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(Math.max(Math.floor(parsed), min), max);
}

function flash(query: Record<string, unknown>): { message: string | null; isError: boolean } {
  if (query.ok === 'category') return { message: 'Tool category updated.', isError: false };
  if (query.ok === 'tenant') return { message: 'Tenant override saved.', isError: false };
  if (typeof query.err === 'string') return { message: query.err, isError: true };
  return { message: null, isError: false };
}

agentToolsRouter.get('/', async (req, res) => {
  try {
    const [categories, log] = await Promise.all([
      getAllCategories(),
      getToolCallLog(100),
    ]);
    const notice = flash(req.query as Record<string, unknown>);
    res.render('agent-tools', {
      title: 'Agent Tools',
      categories,
      log,
      message: notice.message,
      messageIsError: notice.isError,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).render('error', { message });
  }
});

agentToolsRouter.post('/:category', async (req, res) => {
  try {
    const category = String(req.params.category ?? '');
    await updateCategory(category, {
      enabled: parseBoolean(req.body?.enabled) ?? false,
      maxCalls: parseNumber(req.body?.maxCalls, 1, 50),
      timeoutMs: parseNumber(req.body?.timeoutMs, 1000, 120000),
      requiresApproval: parseBoolean(req.body?.requiresApproval) ?? false,
    });
    res.redirect('/admin/agent-tools?ok=category');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.redirect('/admin/agent-tools?err=' + encodeURIComponent(message));
  }
});

agentToolsRouter.get('/tenant/:workspaceId', async (req, res) => {
  try {
    const workspaceId = String(req.params.workspaceId ?? '').trim();
    const [categories, overrides] = await Promise.all([
      getAllCategories(),
      getTenantOverrides(workspaceId),
    ]);
    const overrideByCategory = new Map(overrides.map((override) => [override.category, override]));
    const notice = flash(req.query as Record<string, unknown>);
    res.render('agent-tools-tenant', {
      title: 'Tenant Tool Overrides',
      workspaceId,
      categories,
      overrideByCategory,
      message: notice.message,
      messageIsError: notice.isError,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).render('error', { message });
  }
});

agentToolsRouter.post('/tenant/:workspaceId/:category', async (req, res) => {
  const workspaceId = String(req.params.workspaceId ?? '').trim();
  try {
    const category = String(req.params.category ?? '');
    await upsertTenantOverride(workspaceId, category, {
      enabled: parseBoolean(req.body?.enabled) ?? null,
      maxCalls: req.body?.maxCalls === '' ? null : parseNumber(req.body?.maxCalls, 1, 50) ?? null,
      timeoutMs: req.body?.timeoutMs === '' ? null : parseNumber(req.body?.timeoutMs, 1000, 120000) ?? null,
      requiresApproval: parseBoolean(req.body?.requiresApproval) ?? null,
    });
    res.redirect(`/admin/agent-tools/tenant/${encodeURIComponent(workspaceId)}?ok=tenant`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.redirect(`/admin/agent-tools/tenant/${encodeURIComponent(workspaceId)}?err=${encodeURIComponent(message)}`);
  }
});
