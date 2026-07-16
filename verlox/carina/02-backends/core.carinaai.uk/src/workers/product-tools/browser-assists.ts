import { pool } from '../../memory/db.js';
import { loadDepthFeatures } from './features.js';

export type BrowserAssistRecord = {
  id: string;
  workerId: string;
  toolSlug: string;
  url: string;
  screenshotRef: string;
  status: string;
  pauseReason: string;
  createdAt: string;
  updatedAt: string;
};

async function ensureSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS aiva_browser_assists (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID NOT NULL,
      worker_id UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
      tool_slug TEXT NOT NULL DEFAULT 'browser',
      url TEXT NOT NULL DEFAULT '',
      screenshot_ref TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open',
      pause_reason TEXT NOT NULL DEFAULT '',
      meta JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ
    );
  `);
}

function mapRow(row: Record<string, unknown>): BrowserAssistRecord {
  return {
    id: String(row.id),
    workerId: String(row.worker_id),
    toolSlug: String(row.tool_slug ?? 'browser'),
    url: String(row.url ?? ''),
    screenshotRef: String(row.screenshot_ref ?? ''),
    status: String(row.status),
    pauseReason: String(row.pause_reason ?? ''),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export function looksLikeCaptcha(htmlOrText: string): boolean {
  const lower = htmlOrText.toLowerCase();
  return (
    lower.includes('recaptcha')
    || lower.includes('hcaptcha')
    || lower.includes('cf-turnstile')
    || lower.includes('g-recaptcha')
    || /captcha/.test(lower)
  );
}

export async function createBrowserAssist(input: {
  workspaceId: string;
  workerId: string;
  toolSlug?: string;
  url: string;
  screenshotRef?: string;
  pauseReason?: string;
  meta?: Record<string, unknown>;
}): Promise<BrowserAssistRecord> {
  await ensureSchema();
  const result = await pool.query(
    `INSERT INTO aiva_browser_assists
      (workspace_id, worker_id, tool_slug, url, screenshot_ref, status, pause_reason, meta, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'open', $6, $7::jsonb, NOW())
     RETURNING *`,
    [
      input.workspaceId,
      input.workerId,
      input.toolSlug ?? 'browser',
      input.url,
      input.screenshotRef ?? '',
      input.pauseReason ?? 'Possible CAPTCHA or challenge page',
      JSON.stringify(input.meta ?? {}),
    ],
  );
  return mapRow(result.rows[0]);
}

export async function listOpenBrowserAssists(workspaceId: string, workerId?: string) {
  await ensureSchema();
  const result = workerId
    ? await pool.query(
      `SELECT * FROM aiva_browser_assists
       WHERE workspace_id = $1 AND worker_id = $2 AND status = 'open'
       ORDER BY created_at DESC LIMIT 50`,
      [workspaceId, workerId],
    )
    : await pool.query(
      `SELECT * FROM aiva_browser_assists
       WHERE workspace_id = $1 AND status = 'open'
       ORDER BY created_at DESC LIMIT 50`,
      [workspaceId],
    );
  return result.rows.map(mapRow);
}

export async function resumeBrowserAssist(workspaceId: string, assistId: string) {
  await ensureSchema();
  const result = await pool.query(
    `UPDATE aiva_browser_assists SET status = 'resumed', resolved_at = NOW(), updated_at = NOW()
     WHERE workspace_id = $1 AND id = $2 AND status = 'open'
     RETURNING *`,
    [workspaceId, assistId],
  );
  if (result.rows.length === 0) throw new Error('Assist not found or already resolved');
  return mapRow(result.rows[0]);
}

export async function cancelBrowserAssist(workspaceId: string, assistId: string) {
  await ensureSchema();
  await pool.query(
    `UPDATE aiva_browser_assists SET status = 'cancelled', resolved_at = NOW(), updated_at = NOW()
     WHERE workspace_id = $1 AND id = $2 AND status = 'open'`,
    [workspaceId, assistId],
  );
}

export async function runHardBrowserNavigate(input: {
  workspaceId: string;
  workerId: string;
  url: string;
}): Promise<{ ok: boolean; data?: unknown; error?: string; status?: string; assistId?: string }> {
  const features = loadDepthFeatures();
  if (!features.browser.playwrightEnabled) {
    return { ok: false, error: 'Playwright browser disabled in config' };
  }
  if (features.browser.captchaMode === 'disabled') {
    return { ok: false, error: 'Hard browse disabled (captchaMode=disabled)' };
  }
  if (features.browser.domainAllowlistEnforce && features.browser.domainAllowlist.length > 0) {
    try {
      const host = new URL(input.url).hostname;
      if (!features.browser.domainAllowlist.some((d) => host === d || host.endsWith(`.${d}`))) {
        return { ok: false, error: `Domain not allowlisted: ${host}` };
      }
    } catch {
      return { ok: false, error: 'Invalid URL' };
    }
  }

  const { checkPlaywright, browserNavigate } = await import('../../tools/browser/session.js');
  const available = await checkPlaywright();
  if (!available) {
    return { ok: false, error: 'Playwright is not installed in this environment' };
  }

  const sessionId = `aiva:${input.workspaceId}:${input.workerId}`;
  const nav = await browserNavigate(sessionId, input.url) as {
    url?: string;
    snapshot?: string;
    error?: string;
  };
  if (nav.error) {
    return { ok: false, error: nav.error, data: nav };
  }

  const pageText = typeof nav.snapshot === 'string' ? nav.snapshot : JSON.stringify(nav);
  if (looksLikeCaptcha(pageText) || looksLikeCaptcha(nav.url ?? input.url)) {
    if (features.browser.captchaMode === 'provider' && features.browser.captchaProvider) {
      return {
        ok: false,
        status: 'needs_provider',
        error: `CAPTCHA provider ${features.browser.captchaProvider} not configured with credentials`,
        data: nav,
      };
    }
    const assist = await createBrowserAssist({
      workspaceId: input.workspaceId,
      workerId: input.workerId,
      url: nav.url ?? input.url,
      pauseReason: 'Possible CAPTCHA or challenge detected',
      meta: { snapshotPreview: pageText.slice(0, 500) },
    });
    return {
      ok: false,
      status: 'needs_owner',
      assistId: assist.id,
      error: 'Hard browse paused for owner assist (CAPTCHA/challenge). Resume from Browser assists.',
      data: { assist, nav },
    };
  }

  return { ok: true, data: nav };
}
