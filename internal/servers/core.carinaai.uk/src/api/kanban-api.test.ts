import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../agents/kanban-service.js', () => ({
  getBoardView: vi.fn(),
  createBoardCard: vi.fn(),
  patchCard: vi.fn(),
  transitionCard: vi.fn(),
  workerClaimCard: vi.fn(),
  workerReleaseCard: vi.fn(),
  orchestratorCloseCard: vi.fn(),
  runCardWork: vi.fn(),
  addComment: vi.fn(),
  listComments: vi.fn(),
}));

vi.mock('../agents/kanban-store.js', () => ({
  blockCard: vi.fn(),
  unblockCard: vi.fn(),
}));

const { kanbanApiRouter } = await import('./kanban-api.js');
const service = await import('../agents/kanban-service.js');

import express from 'express';
import session from 'express-session';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test', resave: false, saveUninitialized: true }));
  app.use((req, _res, next) => {
    req.session.webAuthed = true;
    next();
  });
  app.use('/api/kanban', kanbanApiRouter);
  return app;
}

async function getJson(path: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const app = makeApp();
  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`);
    const body = await res.json() as Record<string, unknown>;
    return { status: res.status, body };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe('kanban-api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns board view', async () => {
    vi.mocked(service.getBoardView).mockResolvedValue({
      board_id: 'default',
      session_id: 'op:default',
      columns: { backlog: [] },
    });
    const { status, body } = await getJson('/api/kanban/board?profile=default');
    expect(status).toBe(200);
    expect(body.session_id).toBe('op:default');
  });
});
