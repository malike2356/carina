import { describe, expect, it } from 'vitest';
import {
  githubBridgeConfigPath,
  githubBridgeIndexPath,
  githubBridgeTokenPath,
  normalizeConfig,
  resolveGithubBridgeScope,
} from './config.js';
import { DEFAULT_CONFIG } from './types.js';

describe('github bridge scope resolution', () => {
  it('uses workspace scope by default', () => {
    const resolved = resolveGithubBridgeScope({ workspaceId: 'workspace-1' });
    expect(resolved).toEqual({
      scopeKind: 'workspace',
      scopeId: 'workspace-1',
      scopeKey: 'workspace:workspace-1',
    });
  });

  it('uses user scope when requested', () => {
    const resolved = resolveGithubBridgeScope({ scopeKind: 'user', userId: 'user-7' });
    expect(resolved).toEqual({
      scopeKind: 'user',
      scopeId: 'user-7',
      scopeKey: 'user:user-7',
    });
  });

  it('uses shared scope when requested', () => {
    const resolved = resolveGithubBridgeScope({ scopeKind: 'shared', scopeId: 'shared' });
    expect(resolved).toEqual({
      scopeKind: 'shared',
      scopeId: 'shared',
      scopeKey: 'shared:shared',
    });
  });

  it('keeps files separated by scope key', () => {
    const scope = resolveGithubBridgeScope({ scopeKind: 'user', scopeId: 'user-7' });
    expect(githubBridgeConfigPath(scope.scopeKey)).toContain('user:user-7');
    expect(githubBridgeTokenPath(scope.scopeKey)).toContain('user:user-7');
    expect(githubBridgeIndexPath(scope.scopeKey)).toContain('user:user-7');
  });
});

describe('normalizeConfig', () => {
  it('preserves a safe default scope and defaults', () => {
    const normalized = normalizeConfig(null);
    expect(normalized.scopeKind).toBe(DEFAULT_CONFIG.scopeKind);
    expect(normalized.scopeId).toBe(DEFAULT_CONFIG.scopeId);
    expect(normalized.enabled).toBe(false);
  });

  it('keeps the product mount explicit when supplied', () => {
    const normalized = normalizeConfig({ product: 'carina' });
    expect(normalized.product).toBe('carina');
  });
});
