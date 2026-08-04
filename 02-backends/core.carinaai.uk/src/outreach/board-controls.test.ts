import fs from 'fs';
import path from 'path';
import os from 'os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyOutreachStore, resetOutreachStoreCache, saveOutreachStore } from './store.js';
import { updateOutreachBoardConfig, getOutreachBoardConfig, buildOutreachBoardSummary } from './kanban.js';
import { getOutreachAlertTarget, updateOutreachAlertTarget, outreachAlertTargetSummary } from './alerts.js';

vi.mock('../agents/kanban-service.js', () => ({
  addComment: vi.fn(),
  createBoardCard: vi.fn(),
  patchCard: vi.fn(),
  transitionCard: vi.fn(),
}));

let tmpHome = '';

beforeEach(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-outreach-board-'));
  vi.stubEnv('CARINA_HOME', tmpHome);
  resetOutreachStoreCache();
  saveOutreachStore({
    ...emptyOutreachStore(),
    leads: [
      {
        id: 'lead-1',
        workspaceId: 'ws-1',
        name: 'Jane Prospect',
        email: 'jane@example.com',
        source: 'manual',
        status: 'new',
        tags: [],
        replyState: 'none',
        bookingState: 'none',
        linkedLeadIds: [],
        createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-01T10:00:00.000Z',
        lastContactedAt: '2026-08-01T10:00:00.000Z',
        timeline: [],
      },
    ],
  });
});

afterEach(() => {
  resetOutreachStoreCache();
  vi.unstubAllEnvs();
});

describe('outreach board and follow-up controls', () => {
  it('stores board and alert config and builds summaries', () => {
    const board = updateOutreachBoardConfig('ws-1', {
      backend: 'native',
      nativeSessionId: 'session-1',
      nativeBoardId: 'board-1',
      enabled: true,
    });
    expect(board.backend).toBe('native');
    expect(getOutreachBoardConfig('ws-1')?.nativeSessionId).toBe('session-1');
    expect(buildOutreachBoardSummary('ws-1').configured).toBe(true);

    const target = updateOutreachAlertTarget('ws-1', {
      enabled: true,
      channel: 'telegram',
      conversationId: '123456',
      label: 'Owner chat',
    });
    expect(getOutreachAlertTarget('ws-1').conversationId).toBe('123456');
    expect(outreachAlertTargetSummary(target)).toContain('Owner chat');
  });

});
