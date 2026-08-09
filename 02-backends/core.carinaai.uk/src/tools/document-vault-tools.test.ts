import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../workers/worker-session-context.js', () => ({
  getWorkerSessionContext: vi.fn(),
}));

vi.mock('../workers/aiva-vault-surfaces.js', () => ({
  vaultList: vi.fn(),
  vaultGet: vi.fn(),
  vaultRead: vi.fn(),
  vaultCreate: vi.fn(),
  vaultUpdate: vi.fn(),
  vaultPatch: vi.fn(),
  vaultCopy: vi.fn(),
  vaultTrash: vi.fn(),
  vaultRevisions: vi.fn(),
  vaultPermanentDelete: vi.fn(),
  vaultSyncStatus: vi.fn(async () => ({ ok: true, data: { connection: { connected: false } } })),
  vaultSyncRequest: vi.fn(async () => ({ ok: true, data: { queued: true } })),
}));

import { getWorkerSessionContext } from '../workers/worker-session-context.js';
import { DocumentVaultService } from '../document-vault/service.js';
import { createDefaultContentStore } from '../document-vault/content-store.js';
import { resolveVaultAgentContext } from '../document-vault/agent-context.js';
import { gateVaultAction, redactAuditPayload } from '../document-vault/soft-wall.js';
import {
  createDocumentVaultTools,
  DOCUMENT_VAULT_TOOL_NAMES,
  setDocumentVaultToolServiceForTests,
} from './document-vault-tools.js';

function workerCtx(overrides: Record<string, unknown> = {}) {
  return {
    worker: {
      id: 'w1',
      workspaceId: 'ws-a',
      userId: 'u1',
      status: 'active',
      personaPrompt: '',
      skillPacks: [],
    },
    personaPrompt: '',
    channel: 'work',
    ...overrides,
  } as never;
}

describe('document vault agent tools (712)', () => {
  let tmp: string;
  let svc: DocumentVaultService;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'vault-tools-'));
    svc = new DocumentVaultService(createDefaultContentStore(join(tmp, 'content')), {
      dbPath: join(tmp, 'vault.sqlite'),
    });
    setDocumentVaultToolServiceForTests(svc);
    vi.mocked(getWorkerSessionContext).mockReturnValue(workerCtx());
    delete process.env.CARINA_INTERNAL_KEY;
  });

  afterEach(() => {
    setDocumentVaultToolServiceForTests(null);
    rmSync(tmp, { recursive: true, force: true });
  });

  it('exposes the contract minimum agent tools', () => {
    for (const name of [
      'vault-list',
      'vault-search',
      'vault-inspect',
      'vault-read',
      'vault-create-folder',
      'vault-create-file',
      'vault-update',
      'vault-append',
      'vault-rename',
      'vault-move',
      'vault-copy',
      'vault-trash',
      'vault-restore',
      'vault-revisions',
      'vault-import',
      'vault-export',
      'vault-sync-status',
      'vault-sync-request',
    ]) {
      expect(DOCUMENT_VAULT_TOOL_NAMES).toContain(name);
    }
  });

  it('rejects forged workspace ids and public audience sessions', () => {
    expect(() =>
      resolveVaultAgentContext('sess-1', { workspaceId: 'forged-ws' }),
    ).toThrow(/model-supplied workspace_id rejected/i);

    vi.mocked(getWorkerSessionContext).mockReturnValue(
      workerCtx({ audiencePrincipal: true }),
    );
    expect(() => resolveVaultAgentContext('sess-1', {})).toThrow(/public audience/i);
  });

  it('rejects host filesystem paths', () => {
    expect(() =>
      resolveVaultAgentContext('sess-1', { path: '/etc/passwd' }),
    ).toThrow(/host filesystem/i);
  });

  it('performs authorized CRUD through vault tools', async () => {
    const tools = createDocumentVaultTools('sess-1');
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]));

    const created = await byName['vault-create-file']!.execute({
      name: 'notes.md',
      content: 'hello',
      kind: 'markdown',
    });
    expect(created).toMatchObject({ ok: true });
    const id = (created as { item: { id: string } }).item.id;

    const listed = await byName['vault-list']!.execute({});
    expect(listed).toMatchObject({ ok: true });
    expect((listed as { items: unknown[] }).items.length).toBeGreaterThan(0);

    const read = await byName['vault-read']!.execute({ id });
    expect(read).toMatchObject({ ok: true, content: 'hello' });

    const updated = await byName['vault-update']!.execute({
      id,
      content: 'hello world',
      expectedRevision: 1,
    });
    expect(updated).toMatchObject({ ok: true });

    const stale = await byName['vault-update']!.execute({
      id,
      content: 'stale',
      expectedRevision: 1,
    });
    expect(stale).toMatchObject({ ok: false });
    expect(String((stale as { error?: string }).error ?? '')).toMatch(/stale|revision/i);

    const appended = await byName['vault-append']!.execute({
      id,
      content: '!',
      expectedRevision: 2,
    });
    expect(appended).toMatchObject({ ok: true });

    const trashed = await byName['vault-trash']!.execute({ id });
    expect(trashed).toMatchObject({ ok: true });
  });

  it('gates permanent delete behind Soft Wall approval', async () => {
    const tools = createDocumentVaultTools('sess-1');
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
    const created = await byName['vault-create-file']!.execute({
      name: 'gone.md',
      content: 'x',
    });
    const id = (created as { item: { id: string } }).item.id;
    await byName['vault-trash']!.execute({ id });

    const blocked = gateVaultAction({
      kind: 'document_vault.permanent_delete',
      subject: id,
      payload: redactAuditPayload({ id, token: 'secret' }),
    });
    expect(blocked.allowed).toBe(false);
    expect(redactAuditPayload({ token: 'secret', content: 'body' })).toEqual({
      token: '[redacted]',
      content: '[redacted]',
    });

    const denied = await byName['vault-permanent-delete']!.execute({ id });
    expect(denied).toMatchObject({ ok: false });

    const approval = await byName['vault-request-approval']!.execute({
      action: 'permanent_delete',
      itemIds: [id],
    });
    expect(approval).toMatchObject({ ok: true });
    const token = (approval as { approvalToken: string }).approvalToken;

    const deleted = await byName['vault-permanent-delete']!.execute({
      id,
      approvalToken: token,
    });
    expect(deleted).toMatchObject({ ok: true, deleted: true });
  });
});
