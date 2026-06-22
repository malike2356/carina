import { Router } from 'express';
import { redirectIfAuthed } from '../middleware/auth.js';
import { loginRedirectTarget } from '../lib/callback-url.js';
import {
  findUserByEmail,
  findUserByResetToken,
  generateResetToken,
  recordLogin,
  updatePassword,
  verifyPassword,
} from '../lib/ops-users.js';

export const authRouter = Router();
const uiVersion = process.env.UI_VERSION ?? '20260622g';

function callbackFromRequest(req: { query?: Record<string, unknown>; body?: Record<string, unknown> }): string | undefined {
  const fromBody = req.body?.callbackUrl;
  if (typeof fromBody === 'string' && fromBody.trim()) return fromBody.trim();
  const fromQuery = req.query?.callbackUrl;
  if (typeof fromQuery === 'string' && fromQuery.trim()) return fromQuery.trim();
  return undefined;
}

authRouter.get('/login', redirectIfAuthed, (req, res) => {
  res.render('login', {
    error: null,
    callbackUrl: callbackFromRequest(req) ?? '',
  });
});

authRouter.post('/login', redirectIfAuthed, async (req, res) => {
  const email = String(req.body?.email ?? '').trim();
  const password = String(req.body?.password ?? '');
  const callbackUrl = callbackFromRequest(req) ?? '';

  if (!email || !password) {
    res.status(401).render('login', {
      error: 'Email and password are required.',
      callbackUrl,
    });
    return;
  }

  let user;
  try {
    user = await findUserByEmail(email);
  } catch (err) {
    console.error('[auth.login] database error:', err);
    res.status(503).render('login', {
      error: 'Ops database is temporarily unavailable. Try again in a minute.',
      callbackUrl,
    });
    return;
  }
  if (!user || !(await verifyPassword(user, password))) {
    res.status(401).render('login', {
      error: 'Invalid email or password.',
      callbackUrl,
    });
    return;
  }

  await recordLogin(user.id);

  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.userName = user.name;

  req.session.save((err) => {
    if (err) console.error('[session.save]', err);
    if (user.force_password_change) {
      res.redirect('/users/change-password');
      return;
    }
    res.redirect(loginRedirectTarget(callbackUrl, uiVersion));
  });
});

authRouter.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// Password reset - generate link (superadmin action, handled in users router)
// Public reset page - no auth required
authRouter.get('/reset-password/:token', async (req, res) => {
  const user = await findUserByResetToken(req.params.token);
  if (!user) {
    res.render('reset-password', { token: null, error: 'This reset link has expired or is invalid.' });
    return;
  }
  res.render('reset-password', { token: req.params.token, error: null });
});

authRouter.post('/reset-password/:token', async (req, res) => {
  const user = await findUserByResetToken(req.params.token);
  if (!user) {
    res.render('reset-password', { token: null, error: 'This reset link has expired or is invalid.' });
    return;
  }
  const newPassword = String(req.body?.password ?? '');
  const confirm = String(req.body?.confirm ?? '');
  if (newPassword.length < 8) {
    res.render('reset-password', { token: req.params.token, error: 'Password must be at least 8 characters.' });
    return;
  }
  if (newPassword !== confirm) {
    res.render('reset-password', { token: req.params.token, error: 'Passwords do not match.' });
    return;
  }
  await updatePassword(user.id, newPassword);
  res.render('reset-password', { token: null, error: null, success: true });
});

// Force password change (for accounts with force_password_change = true)
authRouter.get('/users/change-password', (req, res) => {
  if (!req.session?.userId) { res.redirect('/login'); return; }
  res.render('change-password', { error: null });
});

authRouter.post('/users/change-password', async (req, res) => {
  if (!req.session?.userId) { res.redirect('/login'); return; }
  const newPassword = String(req.body?.password ?? '');
  const confirm = String(req.body?.confirm ?? '');
  if (newPassword.length < 8) {
    res.render('change-password', { error: 'Password must be at least 8 characters.' });
    return;
  }
  if (newPassword !== confirm) {
    res.render('change-password', { error: 'Passwords do not match.' });
    return;
  }
  await updatePassword(req.session.userId, newPassword);
  res.redirect('/');
});
