import express from 'express';
import session from 'express-session';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'http';

const chatMock = vi.hoisted(() => vi.fn());

vi.mock('../brain/llm.js', () => ({
  llm: {
    chat: (...args: unknown[]) => chatMock(...args),
  },
}));

async function mountDocumentsRouter(authed: boolean): Promise<{ server: Server; port: number; homeDir: string }> {
  const homeDir = path.join(os.tmpdir(), `carina-documents-api-${randomUUID()}`);
  await fs.mkdir(homeDir, { recursive: true });

  vi.resetModules();
  const { configureDocumentsStore, resetDocumentsStore } = await import('./documents-store.js');
  resetDocumentsStore();
  configureDocumentsStore({ dbPath: path.join(homeDir, 'documents-test.db') });

  const { documentsApiRouter } = await import('./documents-api.js');
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: true }));
  if (authed) {
    app.use((req, _res, next) => {
      req.session.webAuthed = true;
      next();
    });
  }
  app.use('/api/documents', documentsApiRouter);

  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ server, port, homeDir });
    });
  });
}

async function request(
  port: number,
  method: string,
  route: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; json: Record<string, unknown> | null }> {
  const res = await fetch(`http://127.0.0.1:${port}${route}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  if (text) {
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      json = { raw: text };
    }
  }
  return { status: res.status, json };
}

describe('documents-api', () => {
  let server: Server | undefined;
  let homeDir: string | undefined;

  beforeEach(() => {
    chatMock.mockReset();
    chatMock.mockResolvedValue({ content: 'Improved paragraph text.' });
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = undefined;
    }
    const { resetDocumentsStore } = await import('./documents-store.js');
    resetDocumentsStore();
    if (homeDir) {
      await fs.rm(homeDir, { recursive: true, force: true }).catch(() => {});
      homeDir = undefined;
    }
  });

  it('create returns 201 with an id', async () => {
    ({ server, homeDir } = await mountDocumentsRouter(true));
    const port = (server!.address() as { port: number }).port;
    const result = await request(port, 'POST', '/api/documents', {
      title: 'Draft',
      content: 'Hello',
      format: 'markdown',
    });
    expect(result.status).toBe(201);
    expect(result.json?.id).toBeTruthy();
    expect(result.json?.title).toBe('Draft');
  });

  it('list returns empty array before any create', async () => {
    ({ server, homeDir } = await mountDocumentsRouter(true));
    const port = (server!.address() as { port: number }).port;
    const { status, json } = await request(port, 'GET', '/api/documents');
    expect(status).toBe(200);
    expect(json?.documents).toEqual([]);
  });

  it('get returns 404 for unknown id', async () => {
    ({ server, homeDir } = await mountDocumentsRouter(true));
    const port = (server!.address() as { port: number }).port;
    const { status } = await request(port, 'GET', '/api/documents/missing-id');
    expect(status).toBe(404);
  });

  it('update changes content and bumps updated_at', async () => {
    ({ server, homeDir } = await mountDocumentsRouter(true));
    const port = (server!.address() as { port: number }).port;
    const created = await request(port, 'POST', '/api/documents', {
      title: 'Note',
      content: 'v1',
    });
    const id = String(created.json?.id);
    const beforeUpdatedAt = String(created.json?.updatedAt);

    await new Promise((r) => setTimeout(r, 5));

    const updated = await request(port, 'PUT', `/api/documents/${id}`, {
      content: 'v2',
    });
    expect(updated.status).toBe(200);
    expect(updated.json?.content).toBe('v2');
    expect(String(updated.json?.updatedAt)).not.toBe(beforeUpdatedAt);
  });

  it('delete returns 204 and subsequent get returns 404', async () => {
    ({ server, homeDir } = await mountDocumentsRouter(true));
    const port = (server!.address() as { port: number }).port;
    const created = await request(port, 'POST', '/api/documents', { title: 'Temp' });
    const id = String(created.json?.id);

    const deleted = await request(port, 'DELETE', `/api/documents/${id}`);
    expect(deleted.status).toBe(204);

    const missing = await request(port, 'GET', `/api/documents/${id}`);
    expect(missing.status).toBe(404);
  });

  it('ai-assist endpoint returns a non-empty string suggestion', async () => {
    ({ server, homeDir } = await mountDocumentsRouter(true));
    const port = (server!.address() as { port: number }).port;
    const created = await request(port, 'POST', '/api/documents', {
      title: 'Assist me',
      content: 'This paragraph needs clarity.',
    });
    const id = String(created.json?.id);

    const assist = await request(port, 'POST', `/api/documents/${id}/ai-assist`, {
      instruction: 'Improve clarity',
    });
    expect(assist.status).toBe(200);
    expect(String(assist.json?.result).length).toBeGreaterThan(0);
    expect(chatMock).toHaveBeenCalled();
  });
});
