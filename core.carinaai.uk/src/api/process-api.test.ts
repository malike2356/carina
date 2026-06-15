import express from 'express';
import session from 'express-session';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../tools/process-registry.js', () => ({
  listProcessesWithPersistence: vi.fn(),
  getProcessDetail: vi.fn(),
  getProcessLog: vi.fn(),
  killProcess: vi.fn(),
}));

vi.mock('../tools/process-persistence.js', () => ({
  getPersistedProcess: vi.fn(),
}));

const { processApiRouter } = await import('./process-api.js');
const registry = await import('../tools/process-registry.js');
const persistence = await import('../tools/process-persistence.js');

function makeApp() {
  const app = express();
  app.use(session({ secret: 'test', resave: false, saveUninitialized: true }));
  app.use((req, _res, next) => {
    req.session.webAuthed = true;
    next();
  });
  app.use('/api/processes', processApiRouter);
  return app;
}

async function request(method: string, path: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const app = makeApp();
  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { method });
    const body = await res.json() as Record<string, unknown>;
    return { status: res.status, body };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe('process-api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists processes', async () => {
    vi.mocked(registry.listProcessesWithPersistence).mockResolvedValue([
      { session_id: 'p-1', command: 'npm run dev', status: 'running', pid: 99 },
    ]);
    const { status, body } = await request('GET', '/api/processes');
    expect(status).toBe(200);
    expect((body.processes as unknown[]).length).toBe(1);
  });

  it('returns live process detail', async () => {
    vi.mocked(registry.getProcessDetail).mockReturnValue({
      session_id: 'p-1',
      pid: 99,
      command: 'sleep 5',
      status: 'running',
      started_at: new Date().toISOString(),
      uptime: 3,
      output_line_count: 0,
      watch_rules: [],
      matched_patterns: [],
      notify_on_complete: false,
      notify_on_failure: false,
    });
    const { status, body } = await request('GET', '/api/processes/p-1');
    expect(status).toBe(200);
    expect((body.process as { session_id: string }).session_id).toBe('p-1');
  });

  it('falls back to persisted detail when not in memory', async () => {
    vi.mocked(registry.getProcessDetail).mockImplementation(() => {
      throw new Error('Unknown session_id');
    });
    vi.mocked(persistence.getPersistedProcess).mockResolvedValue({
      id: 'p-old',
      pid: 12,
      command: 'old task',
      workdir: null,
      label: null,
      status: 'exited',
      exit_code: 0,
      owner_session_id: null,
      dedupe_key: null,
      watch_rules: [],
      notify_complete: null,
      notify_failure: null,
      matched_patterns: [],
      output_line_count: 4,
      started_at: new Date(),
      ended_at: new Date(),
    });
    const { status, body } = await request('GET', '/api/processes/p-old');
    expect(status).toBe(200);
    expect((body.process as { status: string }).status).toBe('exited');
  });
});
