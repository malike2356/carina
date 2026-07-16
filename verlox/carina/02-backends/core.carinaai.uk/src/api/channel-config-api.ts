import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { pool } from '../memory/db.js';
import {
  encryptCredentials,
  decryptCredentials,
  credentialsConfigured,
} from '../channels/credential-store.js';
import {
  findChannelByAlias,
  listChannelSummaries,
  getSensitiveFieldKeys,
  CHANNEL_REQUIREMENTS,
  type ChannelRequirement,
} from '../channels/channel-requirements.js';
import { isInternalResearchAuthorized } from './internal-research-api.js';

export const channelConfigApiRouter: ExpressRouter = Router();

function isAuthorized(req: Request): boolean {
  return isInternalResearchAuthorized(req);
}

function guard(req: Request, res: Response): boolean {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

function redactCredentials(
  credentials: Record<string, string>,
  sensitiveKeys: Set<string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(credentials)) {
    out[k] = sensitiveKeys.has(k) ? `[${v.length} chars]` : v;
  }
  return out;
}

interface ConfigRow {
  id: string;
  workspace_id: string | null;
  channel_id: string;
  credentials_enc: string;
  status: string;
  requires_restart: boolean;
  last_error: string | null;
  tested_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

async function getRow(channelId: string, workspaceId: string | null): Promise<ConfigRow | null> {
  const result = await pool.query<ConfigRow>(
    `SELECT * FROM channel_configurations
     WHERE channel_id = $1
     AND (workspace_id = $2 OR (workspace_id IS NULL AND $2 IS NULL))
     LIMIT 1`,
    [channelId, workspaceId],
  );
  return result.rows[0] ?? null;
}

function resolveWorkspaceId(req: Request): string | null {
  const header = req.headers['x-workspace-id'];
  const v = Array.isArray(header) ? header[0] : header;
  return v?.trim() || null;
}

// GET /api/internal/channels
// Returns merged registry + DB rows. Never returns decrypted secrets.
channelConfigApiRouter.get('/', async (req: Request, res: Response) => {
  if (!guard(req, res)) return;
  const workspaceId = resolveWorkspaceId(req);

  const dbResult = await pool.query<ConfigRow>(
    `SELECT * FROM channel_configurations
     WHERE workspace_id = $1 OR (workspace_id IS NULL AND $1 IS NULL)`,
    [workspaceId],
  );
  const rowMap = new Map<string, ConfigRow>(dbResult.rows.map((r) => [r.channel_id, r]));

  const channels = listChannelSummaries().map(({ id, name, aliases }) => {
    const row = rowMap.get(id);
    return {
      id,
      name,
      aliases,
      configured: Boolean(row),
      status: row?.status ?? 'not_configured',
      requiresRestart: row?.requires_restart ?? false,
      testedAt: row?.tested_at ?? null,
      lastError: row?.last_error ?? null,
    };
  });

  res.json({ channels });
});

// POST /api/internal/channels/:channelId
// Validates keys, encrypts, upserts. Never logs plaintext credentials.
channelConfigApiRouter.post('/:channelId', async (req: Request, res: Response) => {
  if (!guard(req, res)) return;
  const workspaceId = resolveWorkspaceId(req);
  const channelId = req.params.channelId as string;
  const credentials = (req.body?.credentials ?? {}) as Record<string, string>;

  if (!credentialsConfigured()) {
    res.status(500).json({
      error: 'CHANNEL_CREDENTIAL_KEY is not set. Generate with: openssl rand -hex 32',
    });
    return;
  }

  const channel = CHANNEL_REQUIREMENTS.find((c) => c.id === channelId);
  if (!channel) {
    const match = findChannelByAlias(channelId);
    if (!match) {
      res.status(404).json({ error: `Unknown channel: ${channelId}` });
      return;
    }
    res.redirect(307, `/api/internal/channels/${match.id}`);
    return;
  }

  const missingRequired = channel.fields
    .filter((f) => !f.optional && !credentials[f.key]?.trim())
    .map((f) => f.key);

  if (missingRequired.length > 0) {
    res.status(400).json({
      error: 'Missing required credential fields',
      missing: missingRequired,
    });
    return;
  }

  const enc = encryptCredentials(credentials);

  await pool.query(
    `INSERT INTO channel_configurations
       (channel_id, workspace_id, credentials_enc, status, requires_restart, updated_at)
     VALUES ($1, $2, $3, 'configured', $4, now())
     ON CONFLICT (workspace_id, channel_id)
     DO UPDATE SET
       credentials_enc = EXCLUDED.credentials_enc,
       status = 'configured',
       requires_restart = EXCLUDED.requires_restart,
       last_error = NULL,
       updated_at = now()`,
    [channelId, workspaceId, enc, channel.requiresRestart ?? false],
  );

  res.json({
    ok: true,
    channelId,
    requiresRestart: channel.requiresRestart ?? false,
    message: channel.requiresRestart
      ? `${channel.name} credentials saved. Restart Carina for the channel to activate.`
      : `${channel.name} credentials saved and ready.`,
  });
});

// DELETE /api/internal/channels/:channelId
channelConfigApiRouter.delete('/:channelId', async (req: Request, res: Response) => {
  if (!guard(req, res)) return;
  const workspaceId = resolveWorkspaceId(req);
  const channelId = req.params.channelId as string;

  const existing = await getRow(channelId, workspaceId);
  if (!existing) {
    res.status(404).json({ error: `No configuration found for ${channelId}` });
    return;
  }

  await pool.query(
    `DELETE FROM channel_configurations
     WHERE channel_id = $1
     AND (workspace_id = $2 OR (workspace_id IS NULL AND $2 IS NULL))`,
    [channelId, workspaceId],
  );

  res.json({ ok: true, channelId });
});

// POST /api/internal/channels/:channelId/test
// Decrypts in memory only. Never echoes secrets in response.
channelConfigApiRouter.post('/:channelId/test', async (req: Request, res: Response) => {
  if (!guard(req, res)) return;
  const workspaceId = resolveWorkspaceId(req);
  const channelId = req.params.channelId as string;

  const row = await getRow(channelId, workspaceId);
  if (!row) {
    res.status(404).json({ error: `No configuration found for ${channelId}` });
    return;
  }

  let credentials: Record<string, string>;
  try {
    credentials = decryptCredentials(row.credentials_enc);
  } catch {
    await pool.query(
      `UPDATE channel_configurations SET status = 'error', last_error = $1, updated_at = now()
       WHERE id = $2`,
      ['Failed to decrypt credentials', row.id],
    );
    res.status(500).json({ success: false, message: 'Failed to decrypt stored credentials.' });
    return;
  }

  const result = await runChannelTest(channelId, credentials);

  await pool.query(
    `UPDATE channel_configurations
     SET status = $1, last_error = $2, tested_at = now(), updated_at = now()
     WHERE id = $3`,
    [result.success ? 'active' : 'error', result.success ? null : result.message, row.id],
  );

  res.json(result);
});

async function runChannelTest(
  channelId: string,
  credentials: Record<string, string>,
): Promise<{ success: boolean; message: string }> {
  if (channelId === 'telegram') {
    return testTelegram(credentials.bot_token ?? '');
  }

  if (channelId === 'discord') {
    return testDiscord(credentials.bot_token ?? '');
  }

  if (channelId === 'email') {
    return testSmtp(credentials);
  }

  return {
    success: true,
    message: `${channelId} credentials saved. Live test not available for this channel; restart and verify manually.`,
  };
}

async function testTelegram(botToken: string): Promise<{ success: boolean; message: string }> {
  if (!botToken) return { success: false, message: 'Bot token is missing.' };
  try {
    const resp = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, {
      signal: AbortSignal.timeout(8000),
    });
    const data = (await resp.json()) as { ok?: boolean; result?: { username?: string } };
    if (data?.ok && data?.result?.username) {
      return { success: true, message: `Connected as @${data.result.username}` };
    }
    return { success: false, message: 'Telegram API returned an error. Check the bot token.' };
  } catch {
    return { success: false, message: 'Could not reach Telegram API. Check network connectivity.' };
  }
}

async function testDiscord(botToken: string): Promise<{ success: boolean; message: string }> {
  if (!botToken) return { success: false, message: 'Bot token is missing.' };
  try {
    const resp = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bot ${botToken}` },
      signal: AbortSignal.timeout(8000),
    });
    if (resp.ok) {
      const data = (await resp.json()) as { username?: string };
      return { success: true, message: `Connected as ${data.username ?? 'Discord bot'}.` };
    }
    return { success: false, message: 'Discord API rejected the bot token.' };
  } catch {
    return { success: false, message: 'Could not reach Discord API. Check network connectivity.' };
  }
}

async function testSmtp(
  credentials: Record<string, string>,
): Promise<{ success: boolean; message: string }> {
  const { smtp_host, smtp_port } = credentials;
  if (!smtp_host || !smtp_port) {
    return { success: false, message: 'SMTP host and port are required for testing.' };
  }
  // TCP reachability check only - avoid importing SMTP library.
  try {
    const net = await import('net');
    const port = Number(smtp_port) || 587;
    await new Promise<void>((resolve, reject) => {
      const socket = net.default.createConnection({ host: smtp_host, port, timeout: 6000 });
      socket.once('connect', () => { socket.destroy(); resolve(); });
      socket.once('error', reject);
      socket.once('timeout', () => { socket.destroy(); reject(new Error('timeout')); });
    });
    return { success: true, message: `SMTP host ${smtp_host}:${port} is reachable. Credentials saved; full auth test requires sending a test message.` };
  } catch {
    return { success: false, message: `Could not connect to SMTP host ${smtp_host}:${smtp_port}. Check the host and port.` };
  }
}

export function getChannelConfigRouter(): ExpressRouter {
  return channelConfigApiRouter;
}

// Re-export for Phase 7 dashboard sync use
export async function getConfiguredChannels(workspaceId: string | null): Promise<
  Array<{ channelId: string; status: string; requiresRestart: boolean; testedAt: Date | null }>
> {
  const sensitiveKeys = getSensitiveFieldKeys();
  void sensitiveKeys; // used in full impl; retained for future logging
  const result = await pool.query<ConfigRow>(
    `SELECT * FROM channel_configurations
     WHERE workspace_id = $1 OR (workspace_id IS NULL AND $1 IS NULL)`,
    [workspaceId],
  );
  return result.rows.map((r) => ({
    channelId: r.channel_id,
    status: r.status,
    requiresRestart: r.requires_restart,
    testedAt: r.tested_at,
  }));
}

// Re-export for channel_config tool (Phase 4)
export async function getChannelConfiguration(
  channelId: string,
  workspaceId: string | null,
): Promise<ConfigRow | null> {
  return getRow(channelId, workspaceId);
}

export async function saveChannelConfiguration(
  channel: ChannelRequirement,
  credentials: Record<string, string>,
  workspaceId: string | null,
): Promise<{ ok: boolean; requiresRestart: boolean; error?: string }> {
  if (!credentialsConfigured()) {
    return { ok: false, requiresRestart: false, error: 'CHANNEL_CREDENTIAL_KEY not set' };
  }
  try {
    const enc = encryptCredentials(credentials);
    await pool.query(
      `INSERT INTO channel_configurations
         (channel_id, workspace_id, credentials_enc, status, requires_restart, updated_at)
       VALUES ($1, $2, $3, 'configured', $4, now())
       ON CONFLICT (workspace_id, channel_id)
       DO UPDATE SET
         credentials_enc = EXCLUDED.credentials_enc,
         status = 'configured',
         requires_restart = EXCLUDED.requires_restart,
         last_error = NULL,
         updated_at = now()`,
      [channel.id, workspaceId, enc, channel.requiresRestart ?? false],
    );
    return { ok: true, requiresRestart: channel.requiresRestart ?? false };
  } catch (err) {
    return { ok: false, requiresRestart: false, error: String(err) };
  }
}

export async function removeChannelConfiguration(
  channelId: string,
  workspaceId: string | null,
): Promise<{ ok: boolean }> {
  await pool.query(
    `DELETE FROM channel_configurations
     WHERE channel_id = $1
     AND (workspace_id = $2 OR (workspace_id IS NULL AND $2 IS NULL))`,
    [channelId, workspaceId],
  );
  return { ok: true };
}

export async function testChannelConfiguration(
  channelId: string,
  workspaceId: string | null,
): Promise<{ success: boolean; message: string }> {
  const row = await getRow(channelId, workspaceId);
  if (!row) return { success: false, message: `No configuration found for ${channelId}` };

  let credentials: Record<string, string>;
  try {
    credentials = decryptCredentials(row.credentials_enc);
  } catch {
    return { success: false, message: 'Failed to decrypt stored credentials.' };
  }

  const result = await runChannelTest(channelId, credentials);

  await pool.query(
    `UPDATE channel_configurations
     SET status = $1, last_error = $2, tested_at = now(), updated_at = now()
     WHERE id = $3`,
    [result.success ? 'active' : 'error', result.success ? null : result.message, row.id],
  );

  return result;
}
