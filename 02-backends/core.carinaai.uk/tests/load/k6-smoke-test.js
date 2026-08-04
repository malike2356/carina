// k6 smoke/load test for the Carina core backend.
//
// Run locally (server started with `npm run dev` or similar, default port 3000):
//   k6 run tests/load/k6-smoke-test.js
//
// Run against a deployed environment:
//   BASE_URL=https://core.carinaai.uk k6 run tests/load/k6-smoke-test.js
//
// This targets unauthenticated, side-effect-free routes only: the health
// checks and public platform info endpoint. Auth-gated flows (login,
// workspace list, agent chat) are deliberately not exercised here because
// they require a seeded test account, are covered by brute-force lockout
// and Redis rate limiting (see src/security/redis-rate-limit.ts,
// src/security/auth-rate-limit.ts), and a naive load test would either
// trip that lockout for a real account or need a dedicated test-only
// bypass that does not exist in this codebase. A commented-out sketch is
// included below for a future authenticated smoke scenario once a
// disposable load-test account and a way to skip rate limiting for it
// (for example, CARINA_RATE_LIMIT=off in a dedicated staging environment)
// are available.
//
// Thresholds match the acceptance criteria from the production hardening
// prompt: P95 under 500ms, P99 under 2s, error rate under 0.1%.

import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // Ramp up
    { duration: '1m', target: 100 }, // Peak
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<2000'],
    http_req_failed: ['rate<0.001'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  group('health checks', () => {
    // Primary unauthenticated health probe (not under the /api rate-limit
    // middleware; see packages/web/src/web-server.ts).
    const healthRes = http.get(`${BASE_URL}/health`);
    check(healthRes, {
      'health status is 200 or 503': (r) => r.status === 200 || r.status === 503,
      'health has ok/status field': (r) => {
        try {
          const body = r.json();
          return typeof body.ok === 'boolean' || typeof body.status === 'string';
        } catch {
          return false;
        }
      },
    });

    // Ops health check (static payload, no auth required).
    const opsHealthRes = http.get(`${BASE_URL}/api/ops/health`);
    check(opsHealthRes, {
      'ops health is 200': (r) => r.status === 200,
    });
  });

  group('public platform info', () => {
    // Explicitly unauthenticated per src/api/gateway-routes.ts.
    const platformHealthRes = http.get(`${BASE_URL}/api/v1/platform/health`);
    check(platformHealthRes, {
      'platform health is 200': (r) => r.status === 200,
    });

    const platformInfoRes = http.get(`${BASE_URL}/api/v1/platform/info`);
    check(platformInfoRes, {
      'platform info is 200': (r) => r.status === 200,
    });
  });

  // --- Authenticated flow (skipped by default) -----------------------
  //
  // Uncomment and configure once a disposable load-test account exists in
  // the target environment. Do not point this at production without a
  // dedicated account, because /api/auth/login is brute-force protected
  // (5 failures / 15 minutes, src/security/auth-rate-limit.ts) and
  // rate-limited (5 requests / minute per IP by default,
  // src/security/redis-rate-limit.ts). A failed or misconfigured run
  // here will lock out the test account or trip the login rate limit for
  // the whole test run.
  //
  // group('authenticated flow', () => {
  //   const loginRes = http.post(
  //     `${BASE_URL}/api/auth/login`,
  //     JSON.stringify({
  //       email: __ENV.LOAD_TEST_EMAIL,
  //       password: __ENV.LOAD_TEST_PASSWORD,
  //     }),
  //     { headers: { 'Content-Type': 'application/json' } },
  //   );
  //   check(loginRes, { 'login OK': (r) => r.status === 200 });
  //   const token = loginRes.json('token');
  //
  //   const wsRes = http.get(`${BASE_URL}/api/workspace/presets`, {
  //     headers: { Authorization: `Bearer ${token}` },
  //   });
  //   check(wsRes, { 'workspace presets OK': (r) => r.status === 200 });
  // });

  sleep(1);
}
