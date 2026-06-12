import { afterEach, describe, expect, it } from 'vitest';
import {
  createJitGrant,
  grantCoversAction,
  hasValidJitGrant,
  resetJitGrantsForTests,
  revokeJitGrant,
  listSessionGrants,
} from '../jit-privileges.js';

describe('JitPrivileges', () => {
  afterEach(() => resetJitGrantsForTests());

  it('creates and retrieves a grant', async () => {
    const grant = await createJitGrant({
      sessionId: 'sess-j1',
      instanceId: 'inst-1',
      scope: 'tool',
      toolName: 'shell-exec',
      durationSeconds: 300,
      grantedBy: 'operator',
    });
    expect(grant.id).toBeTruthy();
    expect(grant.toolName).toBe('shell-exec');
  });

  it('covers matching tool actions', () => {
    const grant = {
      id: 'g1',
      sessionId: 's1',
      instanceId: 'i1',
      scope: 'tool' as const,
      toolName: 'file-write',
      grantedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      grantedBy: 'op',
    };
    expect(grantCoversAction(grant, 'file-write')).toBe(true);
    expect(grantCoversAction(grant, 'web-search')).toBe(false);
  });

  it('finds valid grants for a session', async () => {
    await createJitGrant({
      sessionId: 'sess-j2',
      instanceId: 'inst-1',
      scope: 'session',
      durationSeconds: 300,
      grantedBy: 'operator',
    });
    const found = await hasValidJitGrant('sess-j2', 'shell-exec');
    expect(found).not.toBeNull();
  });

  it('expires grants on revoke', async () => {
    const grant = await createJitGrant({
      sessionId: 'sess-j3',
      instanceId: 'inst-1',
      scope: 'tool',
      toolName: 'http-request',
      durationSeconds: 300,
      grantedBy: 'operator',
    });
    await revokeJitGrant(grant.id);
    const grants = await listSessionGrants('sess-j3');
    expect(grants.length).toBe(0);
  });
});
