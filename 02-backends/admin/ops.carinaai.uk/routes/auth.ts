import { Router } from 'express';
import { redirectIfAuthed } from '../middleware/auth.js';
import { loginRedirectTarget } from '../lib/callback-url.js';
import {
  findUserByEmail,
  findUserByResetToken,
  recordLogin,
  updatePassword,
  verifyPassword,
} from '../lib/ops-users.js';
import { loginAdminOperator, loginAdminOperatorViaGoogle, verifyAdminTotp } from '../lib/admin-bridge.js';
import { applyBusinessAdminBridge } from '../lib/ensure-business-admin.js';
import {
  buildGoogleAuthorizeUrl,
  createGoogleOidcState,
  exchangeGoogleOidcCode,
  isGoogleOidcConfigured,
  validateGoogleOidcProfile,
} from '../lib/google-oidc.js';

export const authRouter = Router();
const uiVersion = process.env.UI_VERSION ?? '20260622g';

function callbackFromRequest(req: { query?: Record<string, unknown>; body?: Record<string, unknown> }): string | undefined {
  const fromBody = req.body?.callbackUrl;
  if (typeof fromBody === 'string' && fromBody.trim()) return fromBody.trim();
  const fromQuery = req.query?.callbackUrl;
  if (typeof fromQuery === 'string' && fromQuery.trim()) return fromQuery.trim();
  return undefined;
}

function renderLogin(
  res: import('express').Response,
  options: {
    error?: string | null;
    callbackUrl?: string;
    email?: string;
    totpStep?: 'totp_setup' | 'totp_verify' | null;
    pendingToken?: string;
    otpauthUrl?: string;
    googleOidcEnabled?: boolean;
  },
): void {
  res.render('login', {
    error: options.error ?? null,
    callbackUrl: options.callbackUrl ?? '',
    email: options.email ?? '',
    totpStep: options.totpStep ?? null,
    pendingToken: options.pendingToken ?? '',
    otpauthUrl: options.otpauthUrl ?? '',
    googleOidcEnabled: options.googleOidcEnabled ?? isGoogleOidcConfigured(),
  });
}

function saveSessionAndRedirect(
  req: import('express').Request,
  res: import('express').Response,
  callbackUrl: string,
  forcePasswordChange?: boolean,
): void {
  req.session.save((err) => {
    if (err) console.error('[session.save]', err);
    if (forcePasswordChange) {
      res.redirect('/users/change-password');
      return;
    }
    res.redirect(loginRedirectTarget(callbackUrl, uiVersion));
  });
}

authRouter.get('/login', redirectIfAuthed, (req, res) => {
  renderLogin(res, { callbackUrl: callbackFromRequest(req) ?? '' });
});

authRouter.get('/auth/google', redirectIfAuthed, (req, res) => {
  if (!isGoogleOidcConfigured()) {
    renderLogin(res, {
      error: 'Google sign-in is not configured on this server.',
      callbackUrl: callbackFromRequest(req) ?? '',
    });
    return;
  }

  const callbackUrl = callbackFromRequest(req) ?? '';
  const state = createGoogleOidcState();
  req.session.googleOidcState = state;
  req.session.googleOidcReturnUrl = callbackUrl;
  req.session.save((err) => {
    if (err) {
      console.error('[auth.google]', err);
      renderLogin(res, { error: 'Could not start Google sign-in. Try again.', callbackUrl });
      return;
    }
    res.redirect(buildGoogleAuthorizeUrl(state));
  });
});

authRouter.get('/auth/google/callback', redirectIfAuthed, async (req, res) => {
  const callbackUrl = req.session.googleOidcReturnUrl ?? '';
  const expectedState = req.session.googleOidcState;
  const state = String(req.query.state ?? '');
  const code = String(req.query.code ?? '');
  const oauthError = String(req.query.error ?? '');

  delete req.session.googleOidcState;
  delete req.session.googleOidcReturnUrl;

  if (oauthError) {
    renderLogin(res, {
      error: oauthError === 'access_denied'
        ? 'Google sign-in was cancelled.'
        : 'Google sign-in failed. Try again.',
      callbackUrl,
    });
    return;
  }

  if (!expectedState || !state || state !== expectedState) {
    renderLogin(res, { error: 'Google sign-in session expired. Try again.', callbackUrl });
    return;
  }

  if (!code) {
    renderLogin(res, { error: 'Google did not return an authorization code.', callbackUrl });
    return;
  }

  let profile;
  try {
    profile = await exchangeGoogleOidcCode(code);
  } catch (err) {
    console.error('[auth.google.callback] token exchange failed:', err);
    renderLogin(res, { error: 'Google sign-in failed. Try again.', callbackUrl });
    return;
  }

  const profileError = validateGoogleOidcProfile(profile);
  if (profileError) {
    renderLogin(res, { error: profileError, callbackUrl, email: profile.email });
    return;
  }

  let opsUser = null;
  try {
    opsUser = await findUserByEmail(profile.email);
  } catch (err) {
    console.error('[auth.google.callback] database error:', err);
    renderLogin(res, {
      error: 'Ops database is temporarily unavailable. Try again in a minute.',
      callbackUrl,
      email: profile.email,
    });
    return;
  }

  const adminResult = await loginAdminOperatorViaGoogle(profile.email);

  if (!opsUser && adminResult.step !== 'complete') {
    renderLogin(res, {
      error: adminResult.error ?? 'No operator account is linked to this Google email.',
      callbackUrl,
      email: profile.email,
    });
    return;
  }

  if (opsUser) {
    await recordLogin(opsUser.id);
    req.session.userId = opsUser.id;
    req.session.role = opsUser.role;
    req.session.userName = opsUser.name;
    req.session.adminEmail = opsUser.email;
  }

  if (adminResult.step === 'complete' && adminResult.adminToken) {
    req.session.adminToken = adminResult.adminToken;
    req.session.adminEmail = adminResult.email;
    req.session.adminUserId = adminResult.userId;
  }

  if (!req.session.userId && !req.session.adminToken) {
    renderLogin(res, {
      error: 'No operator account is linked to this Google email.',
      callbackUrl,
      email: profile.email,
    });
    return;
  }

  saveSessionAndRedirect(req, res, callbackUrl || (req.session.adminToken ? '/business-inner/customers' : '/'));
});

authRouter.post('/login', redirectIfAuthed, async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const totpCode = String(req.body?.totpCode ?? '').trim();
  const pendingToken = String(req.body?.pendingToken ?? '').trim();
  const totpStep = String(req.body?.totpStep ?? '').trim() as 'totp_setup' | 'totp_verify' | '';
  const callbackUrl = callbackFromRequest(req) ?? '';

  if (totpStep && pendingToken && totpCode) {
    const verified = await verifyAdminTotp({
      pendingToken,
      code: totpCode,
      purpose: totpStep === 'totp_setup' ? 'setup' : 'verify',
    });
    if (verified.step !== 'complete' || !verified.adminToken) {
      renderLogin(res, {
        error: verified.error ?? 'Invalid authentication code.',
        callbackUrl,
        email: verified.email ?? email,
        totpStep,
        pendingToken,
        otpauthUrl: req.session?.pendingOtpauthUrl ?? '',
      });
      return;
    }
    req.session.adminToken = verified.adminToken;
    req.session.adminEmail = verified.email;
    req.session.adminUserId = verified.userId;
    delete req.session.pendingTotp;
    delete req.session.pendingToken;
    delete req.session.pendingOtpauthUrl;
    saveSessionAndRedirect(req, res, callbackUrl || '/business-inner/customers');
    return;
  }

  if (!email || !password) {
    renderLogin(res, { error: 'Email and password are required.', callbackUrl });
    return;
  }

  let opsUser = null;
  try {
    opsUser = await findUserByEmail(email);
  } catch (err) {
    console.error('[auth.login] database error:', err);
    renderLogin(res, {
      error: 'Ops database is temporarily unavailable. Try again in a minute.',
      callbackUrl,
      email,
    });
    return;
  }

  const opsPasswordOk = Boolean(opsUser && (await verifyPassword(opsUser, password)));
  const adminResult = await loginAdminOperator({ email, password, totpCode: totpCode || undefined });

  if (!opsPasswordOk && !adminResult.adminToken && adminResult.step !== 'totp_setup' && adminResult.step !== 'totp_verify') {
    renderLogin(res, { error: adminResult.error ?? 'Invalid email or password.', callbackUrl, email });
    return;
  }

  if (opsPasswordOk && opsUser) {
    await recordLogin(opsUser.id);
    req.session.userId = opsUser.id;
    req.session.role = opsUser.role;
    req.session.userName = opsUser.name;
    req.session.adminEmail = opsUser.email;
  }

  if (!req.session.adminToken && req.session.userId) {
    await applyBusinessAdminBridge(req);
  }

  if (
    !req.session.adminToken
    && (adminResult.step === 'totp_setup' || adminResult.step === 'totp_verify')
  ) {
    req.session.pendingTotp = adminResult.step;
    req.session.pendingToken = adminResult.pendingToken;
    req.session.pendingOtpauthUrl = adminResult.otpauthUrl;
    renderLogin(res, {
      callbackUrl,
      email: adminResult.email ?? email,
      totpStep: adminResult.step,
      pendingToken: adminResult.pendingToken ?? '',
      otpauthUrl: adminResult.otpauthUrl ?? '',
    });
    return;
  }

  if (adminResult.step === 'complete' && adminResult.adminToken) {
    req.session.adminToken = adminResult.adminToken;
    req.session.adminEmail = adminResult.email;
    req.session.adminUserId = adminResult.userId;
    delete req.session.pendingTotp;
    delete req.session.pendingToken;
    delete req.session.pendingOtpauthUrl;
  }

  if (!req.session.userId && !req.session.adminToken) {
    renderLogin(res, { error: 'Invalid email or password.', callbackUrl, email });
    return;
  }

  saveSessionAndRedirect(req, res, callbackUrl, opsUser?.force_password_change);
});

authRouter.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

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
