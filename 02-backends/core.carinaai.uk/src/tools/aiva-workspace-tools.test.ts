import { describe, expect, it, vi } from 'vitest';

vi.mock('../workers/worker-session-context.js', () => ({
  getWorkerSessionContext: vi.fn(),
}));

vi.mock('../workers/aiva-workspace-surfaces.js', () => ({
  getWorkspaceInventory: vi.fn(async () => ({ ok: true, data: { sections: { aivas: [] } } })),
  createWorkspaceResearchJob: vi.fn(async () => ({ ok: true, data: { id: 'r1' }, openUrl: '/research' })),
  listWorkspaceResearchJobs: vi.fn(async () => ({ ok: true, data: [] })),
  createWorkspaceDocument: vi.fn(async () => ({ ok: true, data: { id: 'd1' }, openUrl: '/documents' })),
  listWorkspaceDocuments: vi.fn(async () => ({ ok: true, data: [] })),
  getWorkspaceDocument: vi.fn(async () => ({ ok: true, data: { id: 'd1', title: 'Doc', content: 'body' } })),
}));

vi.mock('../workers/aiva-vault-surfaces.js', () => ({
  vaultList: vi.fn(async () => ({ ok: false, error: 'vault offline' })),
  vaultGet: vi.fn(async () => ({ ok: false, error: 'vault offline' })),
  vaultRead: vi.fn(async () => ({ ok: false, error: 'vault offline' })),
  vaultCreate: vi.fn(async () => ({ ok: false, error: 'vault offline' })),
  vaultUpdate: vi.fn(async () => ({ ok: false, error: 'vault offline' })),
  vaultPatch: vi.fn(async () => ({ ok: false, error: 'vault offline' })),
  vaultCopy: vi.fn(async () => ({ ok: false, error: 'vault offline' })),
  vaultTrash: vi.fn(async () => ({ ok: false, error: 'vault offline' })),
  vaultRevisions: vi.fn(async () => ({ ok: false, error: 'vault offline' })),
  vaultPermanentDelete: vi.fn(async () => ({ ok: false, error: 'vault offline' })),
  vaultSyncStatus: vi.fn(async () => ({ ok: false, error: 'vault offline' })),
  vaultSyncRequest: vi.fn(async () => ({ ok: false, error: 'vault offline' })),
}));

vi.mock('./worker-automation.js', () => ({
  createWorkerAutomationTools: vi.fn(() => [
    {
      name: 'worker-automation',
      description: 'mock',
      parameters: { type: 'object', properties: {} },
      execute: vi.fn(async (params: Record<string, unknown>) => ({ ok: true, action: params.action })),
    },
  ]),
}));

vi.mock('./aiva-channel-self-config.js', () => ({
  createAivaChannelSelfConfigTool: vi.fn(() => ({
    name: 'aiva-channel-connect',
    description: 'mock',
    parameters: { type: 'object', properties: {} },
    execute: vi.fn(async () => ({ ok: true })),
  })),
}));

vi.mock('../ingestion/email/worker-approval-store.js', () => ({
  listPendingApprovals: vi.fn(async () => []),
  getApproval: vi.fn(async () => null),
  createEmailApproval: vi.fn(),
}));

vi.mock('../ingestion/email/email-draft-handler.js', () => ({
  sendApprovedEmail: vi.fn(),
  rejectEmailApproval: vi.fn(),
}));

vi.mock('../workers/worker-store.js', () => ({
  getWorker: vi.fn(),
  listWorkerChannels: vi.fn(async () => []),
  pauseWorker: vi.fn(),
  resumeWorker: vi.fn(),
  updateWorker: vi.fn(),
}));

vi.mock('./session-tool-store.js', () => ({
  registerSessionTool: vi.fn(),
}));

import { getWorkerSessionContext } from '../workers/worker-session-context.js';
import {
  getWorkspaceInventory,
  listWorkspaceDocuments,
  getWorkspaceDocument,
} from '../workers/aiva-workspace-surfaces.js';
import { registerSessionTool } from './session-tool-store.js';
import { createAivaWorkspaceTools, registerAivaWorkspaceSessionTools } from './aiva-workspace-tools.js';

describe('aiva-workspace-tools', () => {
  it('registers operational workspace tool names', () => {
    const names = registerAivaWorkspaceSessionTools('sess-1');
    expect(names).toContain('workspace-inventory');
    expect(names).toContain('workspace-research-create');
    expect(names).toContain('workspace-document-create');
    expect(names).toContain('workspace-document-list');
    expect(names).toContain('workspace-document-get');
    expect(names).toContain('vault-list');
    expect(names).toContain('vault-create-file');
    expect(names).toContain('vault-request-approval');
    expect(names).toContain('workspace-approval-list');
    expect(names).toContain('workspace-schedule-list');
    expect(names).not.toContain('shell-exec');
    expect(registerSessionTool).toHaveBeenCalled();
  });

  it('inventory requires worker session context', async () => {
    vi.mocked(getWorkerSessionContext).mockReturnValue(null);
    const tool = createAivaWorkspaceTools('sess-1').find((t) => t.name === 'workspace-inventory');
    expect(tool).toBeTruthy();
    const result = await tool!.execute({});
    expect(result).toMatchObject({ ok: false });
  });

  it('inventory calls surface helper when worker context exists', async () => {
    vi.mocked(getWorkerSessionContext).mockReturnValue({
      worker: {
        id: 'w1',
        workspaceId: 'ws1',
        status: 'active',
        personaPrompt: '',
        skillPacks: [],
      },
      personaPrompt: '',
    } as never);
    const tool = createAivaWorkspaceTools('sess-1').find((t) => t.name === 'workspace-inventory');
    const result = await tool!.execute({ limit: 5 });
    expect(getWorkspaceInventory).toHaveBeenCalledWith({
      workspaceId: 'ws1',
      workerId: 'w1',
      limit: 5,
    });
    expect(result).toMatchObject({ ok: true });
  });

  it('workspace-document-list returns titles and previews without content bodies', async () => {
    vi.mocked(getWorkerSessionContext).mockReturnValue({
      worker: {
        id: 'w1',
        workspaceId: 'ws1',
        status: 'active',
        personaPrompt: '',
        skillPacks: [],
      },
      personaPrompt: '',
    } as never);
    vi.mocked(listWorkspaceDocuments).mockResolvedValueOnce({
      ok: true,
      data: [
        {
          id: 'doc-1',
          title: 'DBA November pack',
          content: '<html><body>full body</body></html>',
          preview: '<html><body>full body</body></html>',
          chars: 2311,
          format: 'html',
          archived: false,
          createdAt: '2026-08-04T00:00:00.000Z',
          updatedAt: '2026-08-04T00:00:00.000Z',
        },
        {
          id: 'doc-2',
          title: 'Pitch notes',
          content: 'second full body',
          chars: 120,
          format: 'markdown',
          archived: false,
          createdAt: '2026-08-04T00:00:00.000Z',
          updatedAt: '2026-08-04T00:00:00.000Z',
        },
      ],
    });
    const tool = createAivaWorkspaceTools('sess-1').find((t) => t.name === 'workspace-document-list');
    const result = await tool!.execute({ limit: 2 });
    expect(result).toMatchObject({ ok: true, count: 2 });
    expect((result as { documents?: Array<Record<string, unknown>> }).documents?.[0]).toMatchObject({
      id: 'doc-1',
      title: 'DBA November pack',
      preview: expect.any(String),
      chars: 2311,
    });
    expect((result as { documents?: Array<Record<string, unknown>> }).documents?.[0]).not.toHaveProperty('content');
    expect((result as { documents?: Array<Record<string, unknown>> }).documents?.[1]).toMatchObject({
      id: 'doc-2',
      title: 'Pitch notes',
    });
    expect(getWorkspaceDocument).not.toHaveBeenCalled();
  });

  it('blocks scout mode updates from chat', async () => {
    vi.mocked(getWorkerSessionContext).mockReturnValue({
      worker: { id: 'w1', workspaceId: 'ws1', status: 'active', personaPrompt: '', skillPacks: [] },
      personaPrompt: '',
    } as never);
    const tool = createAivaWorkspaceTools('sess-1').find((t) => t.name === 'workspace-worker-scout-mode-update');
    const result = await tool!.execute({ mode: 'off' });
    expect(result).toMatchObject({ ok: false });
  });
});
