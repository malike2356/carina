import { describe, expect, it, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requireAdmin } from './auth.js';

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    path: '/',
    originalUrl: '/',
    url: '/',
    get: () => undefined,
    session: undefined,
    ...overrides,
  } as Request;
}

function mockRes(): Response & { statusCode: number; body: unknown; headers: Record<string, string> } {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
    write(chunk: string) {
      this.body = (this.body ?? '') + chunk;
      return true;
    },
    end() {
      return this;
    },
    redirect(url: string) {
      this.body = url;
      return this;
    },
  };
  return res as Response & typeof res;
}

describe('requireAdmin', () => {
  it('returns JSON 401 for /scout-api without session', () => {
    const req = mockReq({
      originalUrl: '/scout-api/api/status',
      path: '/scout-api/api/status',
      get: () => '*/*',
    });
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    requireAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      ok: false,
      error: 'Session expired. Refresh the page and sign in again.',
      code: 'session_expired',
    });
  });

  it('returns SSE 401 for /scout-api stream without session', () => {
    const req = mockReq({
      originalUrl: '/scout-api/api/stream',
      path: '/scout-api/api/stream',
      get: () => 'text/event-stream',
    });
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    requireAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.headers['Content-Type']).toBe('text/event-stream');
    expect(String(res.body)).toContain('Session expired');
  });

  it('redirects HTML pages without session', () => {
    const req = mockReq({
      originalUrl: '/scout',
      path: '/scout',
      get: () => 'text/html',
    });
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    requireAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.body).toBe('/login?callbackUrl=%2Fscout');
  });
});
