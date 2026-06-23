import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  buildSurfaceSessionMapKey,
  operatorSessionEnabled,
  resolveSurfaceExternalUserId,
  SURFACE_ADOPTION_DECISIONS,
} from './index.js';
import {
  _resetSurfaceSessionStore,
  loadLastSurfaceSession,
  saveLastSurfaceSession,
} from './session-store.js';

describe('surface session keys', () => {
  const prevOperator = process.env.CARINA_OPERATOR_SESSION;

  afterEach(() => {
    if (prevOperator === undefined) delete process.env.CARINA_OPERATOR_SESSION;
    else process.env.CARINA_OPERATOR_SESSION = prevOperator;
  });

  it('scopes sessions per surface and external user by default', () => {
    expect(buildSurfaceSessionMapKey('main', 'tui', 'tui-operator')).toBe(
      'carina:agent:main:gateway:tui:tui-operator',
    );
    expect(buildSurfaceSessionMapKey('main', 'cli', 'local')).toBe(
      'carina:agent:main:gateway:cli:local',
    );
  });

  it('unifies sessions when CARINA_OPERATOR_SESSION=true', () => {
    process.env.CARINA_OPERATOR_SESSION = 'true';
    expect(operatorSessionEnabled()).toBe(true);
    expect(buildSurfaceSessionMapKey('main', 'web', 'default')).toBe(
      'carina:agent:main:gateway:operator',
    );
  });

  it('resolves mobile external ids from device id', () => {
    expect(resolveSurfaceExternalUserId('mobile', { deviceId: 'dev-1' })).toBe('mobile:dev-1');
  });

  it('resolves hosted web external ids', () => {
    expect(resolveSurfaceExternalUserId('web', {
      hostedUserId: 'u1',
      clientSessionId: 'thread-a',
    })).toBe('hosted:u1:thread-a');
  });

  it('resolves desktop external ids from profile', () => {
    expect(resolveSurfaceExternalUserId('desktop', { profile: 'work' })).toBe('work');
    expect(resolveSurfaceExternalUserId('desktop', {})).toBe('desktop-operator');
  });
});

describe('surface session store', () => {
  let tmpHome: string;

  beforeEach(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-surfaces-'));
  });

  afterEach(async () => {
    await _resetSurfaceSessionStore(tmpHome);
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it('persists last TUI session without duplicating web state', async () => {
    await saveLastSurfaceSession('tui', {
      sessionId: 'sess-tui-1',
      externalUserId: 'tui-operator',
      updatedAt: new Date().toISOString(),
    }, tmpHome);

    const loaded = await loadLastSurfaceSession('tui', tmpHome);
    expect(loaded?.sessionId).toBe('sess-tui-1');
    expect(await loadLastSurfaceSession('web', tmpHome)).toBeNull();
  });
});

describe('surface adoption decisions', () => {
  it('documents adopt-now surfaces with entrypoints', () => {
    const now = SURFACE_ADOPTION_DECISIONS.filter((d) => d.adopt === 'now');
    expect(now.length).toBeGreaterThanOrEqual(4);
    for (const row of now) {
      expect(row.entrypoint.length).toBeGreaterThan(0);
    }
    const deferred = SURFACE_ADOPTION_DECISIONS.find((d) => d.surface.includes('Native desktop'));
    expect(deferred?.adopt).toBe('defer');
  });
});
