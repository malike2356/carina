import { Router } from 'express';
import { requireSuperAdmin } from '../middleware/auth.js';
import {
  listUsers,
  createUser,
  updateUser,
  updatePassword,
  generateResetToken,
  findUserById,
  deleteUser,
  type OpsUser,
} from '../lib/ops-users.js';

export const usersRouter = Router();

usersRouter.use(requireSuperAdmin);

usersRouter.get('/', async (req, res) => {
  const users = await listUsers();
  res.render('users/index', { title: 'Users', users, query: req.query });
});

usersRouter.get('/new', (_req, res) => {
  res.render('users/form', { title: 'Add User', user: null, error: null });
});

usersRouter.post('/new', async (req, res) => {
  const { name, email, password, role } = req.body as Record<string, string>;
  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    res.render('users/form', { title: 'Add User', user: null, error: 'Name, email, and password are required.' });
    return;
  }
  if (password.length < 8) {
    res.render('users/form', { title: 'Add User', user: null, error: 'Password must be at least 8 characters.' });
    return;
  }
  const validRoles: OpsUser['role'][] = ['superadmin', 'admin', 'viewer'];
  const safeRole: OpsUser['role'] = validRoles.includes(role as OpsUser['role']) ? (role as OpsUser['role']) : 'admin';
  try {
    await createUser(name.trim(), email.trim(), password, safeRole);
    res.redirect('/users?created=1');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const error = msg.includes('unique') ? 'A user with that email already exists.' : 'Failed to create user.';
    res.render('users/form', { title: 'Add User', user: null, error });
  }
});

usersRouter.get('/:id/edit', async (req, res) => {
  const user = await findUserById(req.params.id);
  if (!user) { res.redirect('/users'); return; }
  res.render('users/form', { title: 'Edit User', user, error: null });
});

usersRouter.post('/:id/edit', async (req, res) => {
  const user = await findUserById(req.params.id);
  if (!user) { res.redirect('/users'); return; }
  const { name, email, role } = req.body as Record<string, string>;
  const validRoles: OpsUser['role'][] = ['superadmin', 'admin', 'viewer'];
  const safeRole: OpsUser['role'] = validRoles.includes(role as OpsUser['role']) ? (role as OpsUser['role']) : 'admin';
  try {
    await updateUser(user.id, { name: name?.trim(), email: email?.trim(), role: safeRole });
    res.redirect('/users?updated=1');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const error = msg.includes('unique') ? 'A user with that email already exists.' : 'Failed to update user.';
    res.render('users/form', { title: 'Edit User', user, error });
  }
});

usersRouter.post('/:id/deactivate', async (req, res) => {
  const user = await findUserById(req.params.id);
  if (!user) { res.redirect('/users'); return; }
  // Prevent deactivating the last superadmin
  const users = await listUsers();
  const superadmins = users.filter(u => u.role === 'superadmin' && u.is_active);
  if (user.role === 'superadmin' && superadmins.length <= 1) {
    res.redirect('/users?error=Cannot+deactivate+the+only+superadmin');
    return;
  }
  await updateUser(user.id, { is_active: false });
  res.redirect('/users?deactivated=1');
});

usersRouter.post('/:id/activate', async (req, res) => {
  await updateUser(req.params.id, { is_active: true });
  res.redirect('/users?activated=1');
});

usersRouter.post('/:id/reset-password', async (req, res) => {
  const user = await findUserById(req.params.id);
  if (!user) { res.redirect('/users'); return; }
  const token = await generateResetToken(user.id);
  const baseUrl = process.env.OPS_BASE_URL ?? `https://ops.carinaai.uk`;
  const resetUrl = `${baseUrl}/reset-password/${token}`;
  res.render('users/reset-link', { title: 'Password Reset Link', user, resetUrl });
});

usersRouter.post('/:id/set-password', async (req, res) => {
  const user = await findUserById(req.params.id);
  if (!user) { res.redirect('/users'); return; }
  const { password, confirm } = req.body as Record<string, string>;
  if (!password || password.length < 8) {
    const users = await listUsers();
    res.render('users/index', { title: 'Users', users, error: 'Password must be at least 8 characters.' });
    return;
  }
  if (password !== confirm) {
    const users = await listUsers();
    res.render('users/index', { title: 'Users', users, error: 'Passwords do not match.' });
    return;
  }
  await updatePassword(user.id, password);
  res.redirect('/users?password_set=1');
});

usersRouter.post('/:id/delete', async (req, res) => {
  const user = await findUserById(req.params.id);
  if (!user) { res.redirect('/users'); return; }
  const users = await listUsers();
  const superadmins = users.filter(u => u.role === 'superadmin');
  if (user.role === 'superadmin' && superadmins.length <= 1) {
    res.redirect('/users?error=Cannot+delete+the+only+superadmin');
    return;
  }
  await deleteUser(user.id);
  res.redirect('/users?deleted=1');
});
