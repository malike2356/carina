import path from 'path';
import { fileURLToPath } from 'url';
import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import {
  createAccount,
  verifyLogin,
  findAccountById,
  generateApiKey,
  listApiKeys,
  revokeApiKey,
} from '../lib/accounts.js';
import { pool } from '../db.js';
import { requireAccount, redirectIfAccountAuthed } from '../middleware/account-session.js';
import type { InstanceStatus } from '../types.js';

export const accountRouter: IRouter = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', '..', 'public');

function servePage(file: string) {
  return (_req: Request, res: Response): void => {
    res.sendFile(path.join(PUBLIC, 'account', file));
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateCredentials(body: unknown): { ok: true; email: string; password: string } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Body must be a JSON object' };
  const b = body as Record<string, unknown>;
  if (typeof b.email !== 'string' || !EMAIL_RE.test(b.email.trim())) {
    return { ok: false, error: 'A valid email is required' };
  }
  if (typeof b.password !== 'string' || b.password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters' };
  }
  return { ok: true, email: b.email.trim(), password: b.password };
}

// --- Pages ---
accountRouter.get('/register', redirectIfAccountAuthed, servePage('register.html'));
accountRouter.get('/login', redirectIfAccountAuthed, servePage('login.html'));
accountRouter.get('/', requireAccount, servePage('dashboard.html'));

// --- Auth actions ---
accountRouter.post('/register', async (req: Request, res: Response): Promise<void> => {
  const validated = validateCredentials(req.body);
  if (!validated.ok) {
    res.status(400).json({ error: validated.error });
    return;
  }
  try {
    const account = await createAccount(validated.email, validated.password);
    req.session.accountId = account.id;
    req.session.lastSeenAt = Date.now();
    res.json({ ok: true, account: { email: account.email } });
  } catch (err) {
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      res.status(409).json({ error: 'An account with that email already exists' });
      return;
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:account] register failed:', msg);
    res.status(500).json({ error: 'Could not create account' });
  }
});

accountRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  const validated = validateCredentials(req.body);
  if (!validated.ok) {
    res.status(400).json({ error: validated.error });
    return;
  }
  try {
    const account = await verifyLogin(validated.email, validated.password);
    if (!account) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    req.session.accountId = account.id;
    req.session.lastSeenAt = Date.now();
    res.json({ ok: true, account: { email: account.email } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:account] login failed:', msg);
    res.status(500).json({ error: 'Login failed' });
  }
});

accountRouter.post('/logout', (req: Request, res: Response): void => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// --- Account data (JSON, session-gated) ---
accountRouter.get('/api/me', requireAccount, async (req: Request, res: Response): Promise<void> => {
  const account = await findAccountById(req.session.accountId as string);
  if (!account) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }
  res.json({ email: account.email, createdAt: account.createdAt });
});

accountRouter.get('/api/keys', requireAccount, async (req: Request, res: Response): Promise<void> => {
  const keys = await listApiKeys(req.session.accountId as string);
  res.json({ keys });
});

accountRouter.post('/api/keys', requireAccount, async (req: Request, res: Response): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const label = typeof body.label === 'string' && body.label.trim() ? body.label.trim().slice(0, 80) : 'Default key';
  try {
    const { plaintext, summary } = await generateApiKey(req.session.accountId as string, label);
    res.json({ key: plaintext, summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:account] key generation failed:', msg);
    res.status(500).json({ error: 'Could not generate key' });
  }
});

accountRouter.delete('/api/keys/:id', requireAccount, async (req: Request, res: Response): Promise<void> => {
  const keyId = typeof req.params.id === 'string' ? req.params.id : '';
  if (!keyId) {
    res.status(400).json({ error: 'key id is required' });
    return;
  }
  const revoked = await revokeApiKey(req.session.accountId as string, keyId);
  if (!revoked) {
    res.status(404).json({ error: 'Key not found' });
    return;
  }
  res.json({ ok: true });
});

accountRouter.get('/api/instances', requireAccount, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query<{
      id: string;
      name: string;
      status: string;
      suspension_reason: string | null;
      last_heartbeat: Date | null;
    }>(
      `SELECT id, name, status, suspension_reason, last_heartbeat
       FROM carina_instances
       WHERE account_id = $1
       ORDER BY created_at ASC`,
      [req.session.accountId],
    );

    const now = Date.now();
    const instances = result.rows.map((row) => {
      const secondsAgo =
        row.last_heartbeat === null ? null : Math.max(0, Math.floor((now - new Date(row.last_heartbeat).getTime()) / 1000));
      const status: InstanceStatus =
        row.status === 'suspended' ? 'suspended' : secondsAgo === null || secondsAgo > 90 ? 'offline' : 'active';
      return {
        id: row.id,
        name: row.name,
        status,
        last_heartbeat: row.last_heartbeat ? new Date(row.last_heartbeat).toISOString() : null,
        secondsAgo,
        suspension_reason: row.suspension_reason,
      };
    });

    res.json({ instances });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:account] instances query failed:', msg);
    res.status(500).json({ error: 'Database error' });
  }
});

accountRouter.get('/api/events', requireAccount, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT e.id, e.severity, e.source, e.event_type, e.description, e.instance_id, e.created_at
       FROM security_events e
       JOIN carina_instances i ON i.id = e.instance_id
       WHERE i.account_id = $1
       ORDER BY e.created_at DESC
       LIMIT 50`,
      [req.session.accountId],
    );
    res.json({ events: result.rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:account] events query failed:', msg);
    res.status(500).json({ error: 'Database error' });
  }
});
