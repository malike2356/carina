import { describe, expect, it } from 'vitest';
import {
  WORKSPACE_CONTAINER_ROOT,
  buildDockerRunArgs,
  parseCdTarget,
  resolveContainerPath,
} from './terminal-sandbox';

describe('terminal sandbox helpers', () => {
  it('resolves cd within workspace root', () => {
    expect(resolveContainerPath(WORKSPACE_CONTAINER_ROOT, 'docs')).toBe('/workspace/docs');
    expect(resolveContainerPath('/workspace/docs', '..')).toBe('/workspace');
  });

  it('rejects cd outside workspace', () => {
    expect(() => resolveContainerPath(WORKSPACE_CONTAINER_ROOT, '/etc')).toThrow(/outside workspace/);
  });

  it('parses cd commands', () => {
    expect(parseCdTarget('ls')).toBeNull();
    expect(parseCdTarget('cd')).toBe('');
    expect(parseCdTarget('cd src')).toBe('src');
  });

  it('builds hardened docker run args', () => {
    const args = buildDockerRunArgs({
      hostDir: '/tmp/ws-1',
      containerCwd: '/workspace',
      command: 'whoami',
      image: 'carina-sandbox:latest',
    });
    expect(args).toContain('--network');
    expect(args).toContain('none');
    expect(args).toContain('--read-only');
    expect(args).toContain('--user');
    expect(args).toContain('1001:1001');
    expect(args).toContain('-v');
    expect(args).toContain('/tmp/ws-1:/workspace:rw');
    expect(args).toContain('whoami');
  });
});
