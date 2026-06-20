import path from 'path';
import { fileURLToPath } from 'url';
import { Router, type IRouter } from 'express';
import bcrypt from 'bcryptjs';
import { redirectIfDashboardAuthed } from '../middleware/dashboard-session.js';
import { config } from '../config/index.js';

export const dashboardLoginRouter: IRouter = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', '..', 'public');

function expectedPassword(): string {
  return process.env.SCOUT_DASHBOARD_PASSWORD?.trim() || config.auth.apiKey;
}

dashboardLoginRouter.get('/login', redirectIfDashboardAuthed, (_req, res) => {
  res.sendFile(path.join(PUBLIC, 'dashboard', 'login.html'));
});

dashboardLoginRouter.post('/login', redirectIfDashboardAuthed, async (req, res) => {
  const password = String(req.body?.password ?? '');
  const expected = expectedPassword();

  let ok = false;
  if (expected.startsWith('$2')) {
    ok = await bcrypt.compare(password, expected);
  } else {
    ok = password === expected;
  }

  if (!ok) {
    res.status(401).json({ error: 'Invalid password' });
    return;
  }

  req.session.dashboardAuthed = true;
  req.session.dashboardLastSeenAt = Date.now();
  req.session.save((err) => {
    if (err) {
      console.error('[scout:dashboard-login] session save failed:', err);
      res.status(500).json({ error: 'Could not create session' });
      return;
    }
    res.json({ ok: true, redirectTo: '/dashboard' });
  });
});

dashboardLoginRouter.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});
