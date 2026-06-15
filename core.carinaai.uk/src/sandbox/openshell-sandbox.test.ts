import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../sandbox/docker-availability.js', () => ({
  checkDocker: vi.fn().mockResolvedValue(true),
}));

describe('openshell-sandbox', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('reports backend enabled from env', async () => {
    vi.stubEnv('CARINA_SANDBOX_BACKEND', 'openshell');
    const { openshellBackendEnabled } = await import('./openshell-sandbox.js');
    expect(openshellBackendEnabled()).toBe(true);
  });

  it('returns error when docker unavailable', async () => {
    const docker = await import('./docker-availability.js');
    vi.mocked(docker.checkDocker).mockResolvedValue(false);
    const { runOpenShellContainer } = await import('./openshell-sandbox.js');
    const result = await runOpenShellContainer('echo hi', 'alpine:latest', {
      timeout: 1000,
      memoryMb: 64,
      networkDisabled: true,
    });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/Docker unavailable/);
  });
});
