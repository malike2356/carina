import express from 'express';
import session from 'express-session';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

process.env.SCOUT_API_KEY = 'test-scout-key';
process.env.SCOUT_SESSION_SECRET = 'test-session-secret';
process.env.SCOUT_DASHBOARD_PASSWORD = 'dashboard-pass';

let dashboardLoginRouter: typeof import('../dashboard-login.js')['dashboardLoginRouter'];
let requireDashboardSession: typeof import('../../middleware/dashboard-session.js')['requireDashboardSession'];

beforeAll(async () => {
  ({ dashboardLoginRouter } = await import('../dashboard-login.js'));
  ({ requireDashboardSession } = await import('../../middleware/dashboard-session.js'));
});

function buildApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: 'test-session-secret',
      resave: false,
      saveUninitialized: false,
    }),
  );
  app.use('/dashboard', dashboardLoginRouter);
  app.get('/dashboard', requireDashboardSession, (_req, res) => {
    res.send('dashboard-ok');
  });
  return app;
}

describe('dashboard login', () => {
  it('serves a proper login page', async () => {
    const res = await request(buildApp()).get('/dashboard/login');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Operator dashboard');
    expect(res.text).toContain('Sign in');
  });

  it('rejects invalid passwords and accepts the configured password', async () => {
    const app = buildApp();
    const agent = request.agent(app);

    const bad = await agent.post('/dashboard/login').send({ password: 'wrong-pass' });
    expect(bad.status).toBe(401);

    const good = await agent.post('/dashboard/login').send({ password: 'dashboard-pass' });
    expect(good.status).toBe(200);
    expect(good.body).toEqual({ ok: true, redirectTo: '/dashboard' });

    const dashboard = await agent.get('/dashboard');
    expect(dashboard.status).toBe(200);
    expect(dashboard.text).toBe('dashboard-ok');
  });

  it('redirects unauthenticated dashboard requests to the login page', async () => {
    const res = await request(buildApp()).get('/dashboard');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/dashboard/login');
  });
});
