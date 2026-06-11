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
  updateAccountPassword,
  activateAccountWithSetupToken,
} from '../lib/accounts.js';
import { config } from '../config/index.js';
import { pool } from '../db.js';
import { requireAccount, redirectIfAccountAuthed } from '../middleware/account-session.js';
import type { InstanceStatus } from '../types.js';
import {
  loadAccountTrustSettings,
  saveAccountTrustSettings,
  type AccountTrustSettings,
} from '../lib/trust-settings.js';
import { loadRecentTrustAttestations } from '../trust/load-trust-attestations.js';
import { formatEventDescription, formatEventTypeLabel } from '../lib/format-event-display.js';

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

const CHECKOUT_URL = 'https://core.carinaai.uk/checkout?plan=scout_pro';

function rejectPublicRegister(res: Response): void {
  res.status(403).json({
    error: 'Accounts are created automatically after Scout checkout. Subscribe first, then use the setup link from your welcome email.',
    checkoutUrl: CHECKOUT_URL,
  });
}

// --- Pages ---
accountRouter.get('/register', redirectIfAccountAuthed, (req, res) => {
  if (!config.auth.allowPublicRegister) {
    res.redirect(CHECKOUT_URL);
    return;
  }
  servePage('register.html')(req, res);
});
accountRouter.get('/activate', redirectIfAccountAuthed, servePage('activate.html'));
accountRouter.get('/login', redirectIfAccountAuthed, servePage('login.html'));
accountRouter.get('/', requireAccount, servePage('dashboard.html'));

// --- Auth actions ---
accountRouter.post('/register', async (req: Request, res: Response): Promise<void> => {
  if (!config.auth.allowPublicRegister) {
    rejectPublicRegister(res);
    return;
  }
  const validated = validateCredentials(req.body);
  if (!validated.ok) {
    res.status(400).json({ error: validated.error });
    return;
  }
  try {
    const account = await createAccount(validated.email, validated.password);
    req.session.accountId = account.id;
    req.session.lastSeenAt = Date.now();
    req.session.save((saveErr) => {
      if (saveErr) {
        console.error('[scout:account] session save failed:', saveErr);
        res.status(500).json({ error: 'Could not create session' });
        return;
      }
      res.json({ ok: true, account: { email: account.email } });
    });
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
    req.session.save((saveErr) => {
      if (saveErr) {
        console.error('[scout:account] session save failed:', saveErr);
        res.status(500).json({ error: 'Could not create session' });
        return;
      }
      res.json({ ok: true, account: { email: account.email } });
    });
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

accountRouter.post('/activate', async (req: Request, res: Response): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!token || password.length < 8) {
    res.status(400).json({ error: 'A valid setup token and password (8+ chars) are required' });
    return;
  }
  const result = await activateAccountWithSetupToken(token, password);
  if (!result.ok) {
    const messages: Record<typeof result.reason, string> = {
      invalid: 'This setup link is invalid. Check your welcome email or contact support.',
      expired: 'This setup link has expired. Contact support for a new link.',
      used: 'This setup link was already used. Sign in with your password instead.',
    };
    res.status(400).json({ error: messages[result.reason] });
    return;
  }
  req.session.accountId = result.account.id;
  req.session.lastSeenAt = Date.now();
  req.session.save((saveErr) => {
    if (saveErr) {
      console.error('[scout:account] session save failed:', saveErr);
      res.status(500).json({ error: 'Could not create session' });
      return;
    }
    res.json({ ok: true, account: { email: result.account.email } });
  });
});

// --- Account data (JSON, session-gated) ---
accountRouter.post('/api/password', requireAccount, async (req: Request, res: Response): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const currentPassword = typeof body.current_password === 'string' ? body.current_password : '';
  const newPassword = typeof body.new_password === 'string' ? body.new_password : '';

  if (!currentPassword) {
    res.status(400).json({ error: 'Current password is required' });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters' });
    return;
  }
  if (currentPassword === newPassword) {
    res.status(400).json({ error: 'New password must be different from the current password' });
    return;
  }

  const result = await updateAccountPassword(
    req.session.accountId as string,
    currentPassword,
    newPassword,
  );
  if (!result.ok) {
    if (result.reason === 'wrong_password') {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }
    res.status(404).json({ error: 'Account not found' });
    return;
  }

  res.json({ ok: true });
});

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

accountRouter.get('/api/trust-settings', requireAccount, async (req: Request, res: Response): Promise<void> => {
  const settings = await loadAccountTrustSettings(req.session.accountId as string);
  res.json({ settings });
});

accountRouter.put('/api/trust-settings', requireAccount, async (req: Request, res: Response): Promise<void> => {
  const body = (req.body ?? {}) as Partial<AccountTrustSettings>;
  const settings = await saveAccountTrustSettings(req.session.accountId as string, {
    tier: body.tier === 'enterprise' ? 'enterprise' : 'standard',
    attestation_interval_days: body.attestation_interval_days ?? 7,
    verification_interval_days: body.verification_interval_days ?? 7,
  });
  res.json({ settings });
});

accountRouter.get('/api/onboarding', requireAccount, async (req: Request, res: Response): Promise<void> => {
  const accountId = req.session.accountId as string;
  const [keys, instances, attestations] = await Promise.all([
    listApiKeys(accountId),
    pool.query<{ id: string; last_heartbeat: Date | null }>(
      `SELECT id, last_heartbeat FROM carina_instances WHERE account_id = $1`,
      [accountId],
    ),
    loadRecentTrustAttestations('carina-reference', 1),
  ]);

  const activeKeys = keys.filter((key) => !key.revokedAt);
  const paired = instances.rows.length > 0;
  const heartbeat = instances.rows.some((row) => row.last_heartbeat !== null);
  const attested = attestations.length > 0;

  const steps = [
    { id: 'account', label: 'Create Scout account', done: true },
    { id: 'api_key', label: 'Generate pairing API key', done: activeKeys.length > 0 },
    { id: 'pair', label: 'Pair Carina instance', done: paired },
    { id: 'heartbeat', label: 'Receive first heartbeat', done: heartbeat },
    { id: 'attestation', label: 'First on-chain attestation', done: attested },
  ];

  res.json({
    steps,
    complete: steps.every((step) => step.done),
    progress: steps.filter((step) => step.done).length,
    total: steps.length,
  });
});

accountRouter.get('/api/events', requireAccount, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(Number.parseInt(String(req.query.page ?? '1'), 10) || 1, 1);
    const limit = Math.max(Math.max(Number.parseInt(String(req.query.limit ?? '15'), 10) || 15, 1), 50);
    const accountId = req.session.accountId as string;

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM security_events e
       JOIN carina_instances i ON i.id = e.instance_id
       WHERE i.account_id = $1
         AND e.event_type <> 'session_metrics'`,
      [accountId],
    );
    const total = Number.parseInt(countResult.rows[0]?.count ?? '0', 10);
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;
    const safePage = totalPages > 0 ? Math.max(1, Math.min(page, totalPages)) : 1;
    const offset = (safePage - 1) * limit;

    const result = await pool.query<{
      id: string;
      severity: string;
      source: string;
      event_type: string;
      description: string;
      instance_id: string | null;
      created_at: Date;
    }>(
      `SELECT e.id, e.severity, e.source, e.event_type, e.description, e.instance_id, e.created_at
       FROM security_events e
       JOIN carina_instances i ON i.id = e.instance_id
       WHERE i.account_id = $1
         AND e.event_type <> 'session_metrics'
       ORDER By e.created_at DESC
       LIMIT $2 OFFSET $3`,
      [accountId, limit, offset],
    );
    const events = result.rows.map((row) => ({
      id: row.id,
      severity: row.severity,
      source: row.source,
      event_type: row.event_type,
      eventTypeLabel: formatEventTypeLabel(row.event_type),
      description: formatEventDescription(row.event_type, row.description, row.instance_id),
      instance_id: row.instance_id,
      created_at: new Date(row.created_at).toISOString(),
    }));
    res.json({
      events,
      pagination: {
        page: safePage,
        limit,
        total,
        totalPages,
        hasPrev: safePage > 1 && totalPages > 0,
        hasNext: safePage < totalPages,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:account] events query failed:', msg);
    res.status(500).json({ error: 'database error' });
  }
});
