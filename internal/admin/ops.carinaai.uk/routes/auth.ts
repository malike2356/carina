import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { redirectIfAuthed } from '../middleware/auth.js';

export const authRouter = Router();
const uiVersion = process.env.UI_VERSION ?? '20260620';

authRouter.get('/login', redirectIfAuthed, (_req, res) => {
  res.render('login', { error: null });
});

authRouter.post('/login', redirectIfAuthed, async (req, res) => {
  const password = String(req.body?.password ?? '');
  const expected = process.env.ADMIN_PASSWORD ?? 'changeme';

  let ok = false;
  if (expected.startsWith('$2')) {
    ok = await bcrypt.compare(password, expected);
  } else {
    ok = password === expected;
  }

  if (!ok) {
    res.status(401).render('login', { error: 'Invalid password' });
    return;
  }

  req.session.admin = true;
  req.session.save((err) => {
    if (err) console.error('[session.save]', err);
    res.redirect('/?v=' + encodeURIComponent(uiVersion));
  });
});

authRouter.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});
