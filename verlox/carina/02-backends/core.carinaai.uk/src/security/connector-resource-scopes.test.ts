import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();

vi.mock('../memory/db.js', () => ({ pool: { query } }));
vi.mock('./security-audit.js', () => ({
  appendSecurityAudit: vi.fn(() => ({ at: new Date().toISOString() })),
}));

async function loadScopes() {
  vi.resetModules();
  return import('./connector-resource-scopes.js');
}

function mockSchema() {
  query.mockResolvedValueOnce({ rows: [] });
  query.mockResolvedValueOnce({ rows: [] });
  query.mockResolvedValueOnce({ rows: [] });
}

describe('connector-resource-scopes', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('allows approved resource reads', async () => {
    mockSchema();
    query.mockResolvedValueOnce({
      rows: [{
        id: 1,
        workspace_id: 'ws-1',
        worker_id: null,
        connector: 'trello',
        resource_kind: 'boards',
        resource_id: 'board-ok',
        label: 'OK',
        actions: ['read', 'write'],
        created_at: new Date(),
        revoked_at: null,
      }],
    });

    const { enforceConnectorResourceScope } = await loadScopes();
    const result = await enforceConnectorResourceScope({
      workspaceId: 'ws-1',
      connector: 'trello',
      action: 'read',
      params: { boardId: 'board-ok' },
    });
    expect(result.allowed).toBe(true);
    expect(result.mode).toBe('scoped');
  });

  it('denies unapproved resource access', async () => {
    mockSchema();
    query.mockResolvedValueOnce({
      rows: [{
        id: 1,
        workspace_id: 'ws-1',
        worker_id: null,
        connector: 'trello',
        resource_kind: 'boards',
        resource_id: 'board-ok',
        label: 'OK',
        actions: ['read', 'write'],
        created_at: new Date(),
        revoked_at: null,
      }],
    });
    // deny event insert
    query.mockResolvedValueOnce({ rows: [] });

    const { enforceConnectorResourceScope } = await loadScopes();
    const result = await enforceConnectorResourceScope({
      workspaceId: 'ws-1',
      connector: 'trello',
      action: 'write',
      params: { boardId: 'board-other' },
    });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('CONNECTOR_SCOPE_DENIED');
  });

  it('fails closed on indeterminate write targets when scoped', async () => {
    mockSchema();
    query.mockResolvedValueOnce({
      rows: [{
        id: 1,
        workspace_id: 'ws-1',
        worker_id: null,
        connector: 'slack',
        resource_kind: 'channels',
        resource_id: 'C123',
        label: 'Support',
        actions: ['read', 'write'],
        created_at: new Date(),
        revoked_at: null,
      }],
    });
    query.mockResolvedValueOnce({ rows: [] });

    const { enforceConnectorResourceScope } = await loadScopes();
    const result = await enforceConnectorResourceScope({
      workspaceId: 'ws-1',
      connector: 'slack',
      action: 'write',
      params: {},
    });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('CONNECTOR_SCOPE_INDETERMINATE');
  });

  it('keeps grants tenant-isolated by workspace id', async () => {
    mockSchema();
    query.mockResolvedValueOnce({ rows: [] }); // no grants for ws-b

    const { enforceConnectorResourceScope } = await loadScopes();
    const result = await enforceConnectorResourceScope({
      workspaceId: 'ws-b',
      connector: 'trello',
      action: 'write',
      params: { boardId: 'board-ok' },
    });
    expect(result.allowed).toBe(true);
    expect(result.mode).toBe('broad');
    expect(query.mock.calls.some((c) => String(c[1]?.[0]) === 'ws-b')).toBe(true);
  });

  it('stops revoked resources immediately', async () => {
    const { enforceConnectorResourceScope, revokeConnectorResource } = await loadScopes();

    mockSchema();
    query.mockResolvedValueOnce({
      rows: [{ connector: 'trello', resource_kind: 'boards', resource_id: 'board-ok' }],
      rowCount: 1,
    });
    query.mockResolvedValueOnce({ rows: [] }); // event

    const revoked = await revokeConnectorResource({
      workspaceId: 'ws-1',
      grantId: 9,
      actor: 'test',
    });
    expect(revoked).toBe(true);

    // Fresh module so schema bootstrap runs again with clean mocks.
    const fresh = await loadScopes();
    mockSchema();
    query.mockResolvedValueOnce({ rows: [] });
    const after = await fresh.enforceConnectorResourceScope({
      workspaceId: 'ws-1',
      connector: 'trello',
      action: 'write',
      params: { boardId: 'board-ok' },
    });
    expect(after.mode).toBe('broad');
    expect(after.allowed).toBe(true);
  });

  it('extracts trello board ids from params', async () => {
    const { extractResourceRefs } = await loadScopes();
    const { refs } = extractResourceRefs('trello', { params: { boardId: 'abc123' } });
    expect(refs).toEqual([{ kind: 'boards', id: 'abc123' }]);
  });

  it('maps connector tools and prefers read defaults for list tools', async () => {
    const { resolveConnectorForTool, inferActionClass } = await loadScopes();
    expect(resolveConnectorForTool('trello-list-boards')).toBe('trello');
    expect(inferActionClass('trello-list-boards')).toBe('read');
    expect(inferActionClass('email-send')).toBe('write');
  });
});
