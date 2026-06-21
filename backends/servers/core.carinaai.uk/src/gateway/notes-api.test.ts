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

async function mountNotesRouter(authed: boolean): Promise<{ server: Server; port: number; homeDir: string }> {
  const homeDir = path.join(os.tmpdir(), `carina-notes-api-${randomUUID()}`);
  await fs.mkdir(homeDir, { recursive: true });

  vi.resetModules();
  const { configureNotesStore, resetNotesStore } = await import('./notes-store.js');
  resetNotesStore();
  configureNotesStore({ dbPath: path.join(homeDir, 'notes-test.db') });

  const { notesApiRouter } = await import('./notes-api.js');
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: true }));
  if (authed) {
    app.use((req, _res, next) => {
      req.session.webAuthed = true;
      next();
    });
  }
  app.use('/api/notes', notesApiRouter);

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

describe('notes-api', () => {
  let server: Server | undefined;
  let homeDir: string | undefined;

  beforeEach(() => {
    chatMock.mockReset();
    chatMock.mockResolvedValue({ content: 'Improved note body.' });
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = undefined;
    }
    const { resetNotesStore } = await import('./notes-store.js');
    resetNotesStore();
    if (homeDir) {
      await fs.rm(homeDir, { recursive: true, force: true }).catch(() => {});
      homeDir = undefined;
    }
  });

  it('creates note, task, and reminder formats', async () => {
    ({ server, homeDir } = await mountNotesRouter(true));
    const port = (server!.address() as { port: number }).port;

    const note = await request(port, 'POST', '/api/notes', {
      title: 'Idea',
      body: 'Capture this',
      format: 'note',
    });
    const task = await request(port, 'POST', '/api/notes', {
      title: 'Ship feature',
      body: 'Finish O5',
      format: 'task',
    });
    const reminder = await request(port, 'POST', '/api/notes', {
      title: 'Standup',
      body: 'Join call',
      format: 'reminder',
      remindAt: new Date(Date.now() + 60_000).toISOString(),
    });

    expect(note.status).toBe(201);
    expect(task.status).toBe(201);
    expect(reminder.status).toBe(201);
    expect(note.json?.format).toBe('note');
    expect(task.json?.format).toBe('task');
    expect(reminder.json?.format).toBe('reminder');
  });

  it('lists notes and filters by format', async () => {
    ({ server, homeDir } = await mountNotesRouter(true));
    const port = (server!.address() as { port: number }).port;
    await request(port, 'POST', '/api/notes', { title: 'A', format: 'note' });
    await request(port, 'POST', '/api/notes', { title: 'B', format: 'task' });

    const all = await request(port, 'GET', '/api/notes');
    const tasks = await request(port, 'GET', '/api/notes?format=task');
    expect((all.json?.notes as unknown[]).length).toBe(2);
    expect((tasks.json?.notes as unknown[]).length).toBe(1);
  });

  it('done toggle updates correctly', async () => {
    ({ server, homeDir } = await mountNotesRouter(true));
    const port = (server!.address() as { port: number }).port;
    const created = await request(port, 'POST', '/api/notes', {
      title: 'Task',
      format: 'task',
      done: false,
    });
    const id = String(created.json?.id);
    const updated = await request(port, 'PUT', `/api/notes/${id}`, { done: true });
    expect(updated.json?.done).toBe(true);
  });

  it('delete returns 204 and subsequent get returns 404', async () => {
    ({ server, homeDir } = await mountNotesRouter(true));
    const port = (server!.address() as { port: number }).port;
    const created = await request(port, 'POST', '/api/notes', { title: 'Temp' });
    const id = String(created.json?.id);
    const deleted = await request(port, 'DELETE', `/api/notes/${id}`);
    expect(deleted.status).toBe(204);
    const missing = await request(port, 'GET', `/api/notes/${id}`);
    expect(missing.status).toBe(404);
  });

  it('ai-assist endpoint returns a non-empty string suggestion', async () => {
    ({ server, homeDir } = await mountNotesRouter(true));
    const port = (server!.address() as { port: number }).port;
    const created = await request(port, 'POST', '/api/notes', {
      title: 'Draft',
      body: 'Needs polish',
      format: 'note',
    });
    const id = String(created.json?.id);
    const assist = await request(port, 'POST', `/api/notes/${id}/ai-assist`, {
      instruction: 'Tighten wording',
    });
    expect(assist.status).toBe(200);
    expect(String(assist.json?.result).length).toBeGreaterThan(0);
  });
});
