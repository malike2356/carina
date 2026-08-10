/**
 * Public/private error handling tests.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  assertNoStackInPublicBody,
  clearErrorLogStore,
  createPublicError,
  detectFiveHundredSpike,
  errorBoundary,
  getErrorContext,
  getPublicMessage,
  jobErrorBoundary,
  logError,
  paymentErrorBoundary,
  redactValue,
  searchErrors,
  sendPublicError,
} from './index.js';

describe('public and private error handling', () => {
  beforeEach(() => {
    clearErrorLogStore();
  });

  it('returns safe public body without stack and links private log', async () => {
    const err = new Error('ECONNREFUSED password authentication failed for role app');
    err.stack = 'Error: boom\n    at Object.<anonymous> (/home/malike/app/src/db.ts:12:3)';
    const pub = createPublicError(err, undefined, 500);
    expect(pub.body.error.reference).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(pub.body.error.message).toBe(getPublicMessage(500));
    expect(assertNoStackInPublicBody(pub.body)).toBe(true);
    expect(JSON.stringify(pub.body)).not.toMatch(/ECONNREFUSED|stack|\/home\//i);

    const entry = logError(err, {
      route: '/api/demo',
      method: 'POST',
      statusCode: 500,
      requestBody: { password: 'hunter2', token: 'abc', note: 'ok' },
    }, pub.reference);

    expect(entry.stack).toContain('db.ts');
    expect(entry.requestBody).toEqual({
      password: '[REDACTED]',
      token: '[REDACTED]',
      note: 'ok',
    });
    expect(getErrorContext(pub.reference)?.errorReference).toBe(pub.reference);
    expect(searchErrors({ route: '/api/demo', statusCode: 500 })[0]?.errorReference).toBe(
      pub.reference,
    );
  });

  it('route boundary returns public JSON and stores private trace', async () => {
    const handler = errorBoundary(async () => {
      throw new Error('SQLSTATE 28P01 password authentication failed');
    });
    let statusCode = 0;
    let body: unknown;
    const res = {
      headersSent: false,
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(payload: unknown) {
        body = payload;
      },
    };
    await handler({ method: 'GET', originalUrl: '/api/x', body: { api_key: 'placeholder-key' } }, res, () => undefined);
    expect(statusCode).toBe(500);
    expect(assertNoStackInPublicBody(body)).toBe(true);
    const ref = (body as { error: { reference: string } }).error.reference;
    const privateRow = getErrorContext(ref)!;
    expect(privateRow.stack).toBeTruthy();
    expect(privateRow.requestBody).toEqual({ api_key: '[REDACTED]' });
  });

  it('payment webhook boundary keeps public response clean and searchable', async () => {
    let body: unknown;
    const res = {
      headersSent: false,
      status() {
        return this;
      },
      json(payload: unknown) {
        body = payload;
      },
    };
    const result = await paymentErrorBoundary(
      'stripe.webhook',
      async () => {
        throw new Error('stripe signature invalid at /opt/app/webhooks.ts:44');
      },
      { req: { method: 'POST', originalUrl: '/webhooks/stripe', body: { card_number: '4111' } }, res },
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(assertNoStackInPublicBody(body)).toBe(true);
    const row = getErrorContext(result.reference)!;
    expect(row.boundary).toBe('payment');
    expect(row.requestBody).toEqual({ card_number: '[REDACTED]' });
    expect(searchErrors({ errorReference: result.reference })[0]?.route).toBe('stripe.webhook');
  });

  it('redacts secrets and detects 500 spikes', async () => {
    expect(redactValue({ Authorization: 'Bearer x', nested: { refresh_token: 'r' } })).toEqual({
      Authorization: '[REDACTED]',
      nested: { refresh_token: '[REDACTED]' },
    });
    for (let i = 0; i < 11; i += 1) {
      logError(new Error(`fail-${i}`), { statusCode: 500, route: '/api/z' });
    }
    const spike = detectFiveHundredSpike();
    expect(spike.triggered).toBe(true);
    expect(spike.count).toBeGreaterThan(10);
    const job = await jobErrorBoundary('nightly', async () => {
      throw new Error('job failed');
    });
    expect(job.ok).toBe(false);
  });

  it('sendPublicError never echoes internal message for 500', () => {
    let body: unknown;
    const res = {
      headersSent: false,
      status() {
        return this;
      },
      json(payload: unknown) {
        body = payload;
      },
    };
    sendPublicError(res, new Error('internal failure near /opt/app/db.ts'), 500);
    expect(JSON.stringify(body)).not.toMatch(/\/opt\/app|internal failure/i);
  });
});
