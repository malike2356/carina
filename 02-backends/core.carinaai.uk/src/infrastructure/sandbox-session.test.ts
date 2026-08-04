import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../ops/sandbox-containers.js', () => ({
  createSandboxContainer: vi.fn(),
  execInSandboxContainer: vi.fn(),
  listSandboxContainers: vi.fn(),
  stopSandboxContainer: vi.fn(),
}));

vi.mock('../tools/sandbox.js', () => ({
  checkDocker: vi.fn(),
}));

describe('sandbox-session', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.CARINA_SANDBOX_SESSION;
    process.env.CARINA_PROFILE = 'test-profile';
  });

  it('builds stable labels per profile and session', async () => {
    const { sessionSandboxLabel } = await import('./sandbox-session.js');
    expect(sessionSandboxLabel('sess/1', 'alpha')).toBe('alpha-sess-1');
    expect(sessionSandboxLabel('sess/1', 'beta')).not.toBe(sessionSandboxLabel('sess/1', 'alpha'));
  });

  it('creates and execs in session sandbox', async () => {
    const containers = await import('../ops/sandbox-containers.js');
    const sandbox = await import('../tools/sandbox.js');
    vi.mocked(sandbox.checkDocker).mockResolvedValue(true);
    vi.mocked(containers.listSandboxContainers).mockResolvedValue([]);
    vi.mocked(containers.createSandboxContainer).mockResolvedValue({
      name: 'carina-sandbox-test-profile-s1',
      created: true,
      message: 'ok',
    });
    vi.mocked(containers.execInSandboxContainer).mockResolvedValue({
      stdout: 'hello',
      stderr: '',
      exitCode: 0,
    });

    const { execInSessionSandbox, explainSessionSandbox } = await import('./sandbox-session.js');
    const result = await execInSessionSandbox('s1', 'echo hello');
    expect(containers.createSandboxContainer).toHaveBeenCalled();
    expect(result.stdout).toBe('hello');
    expect(explainSessionSandbox(result.sandbox)).toContain('profile=test-profile');
  });

  it('destroys session sandbox via stop', async () => {
    const containers = await import('../ops/sandbox-containers.js');
    vi.mocked(containers.stopSandboxContainer).mockResolvedValue(true);
    const { destroySessionSandbox } = await import('./sandbox-session.js');
    const ok = await destroySessionSandbox('s1', 'alpha');
    expect(ok).toBe(true);
    expect(containers.stopSandboxContainer).toHaveBeenCalledWith('alpha-s1');
  });

  it('recreate stops then creates sandbox', async () => {
    const containers = await import('../ops/sandbox-containers.js');
    const sandbox = await import('../tools/sandbox.js');
    vi.mocked(sandbox.checkDocker).mockResolvedValue(true);
    vi.mocked(containers.listSandboxContainers).mockResolvedValue([]);
    vi.mocked(containers.stopSandboxContainer).mockResolvedValue(true);
    vi.mocked(containers.createSandboxContainer).mockResolvedValue({
      name: 'carina-sandbox-test-profile-s1',
      created: true,
      message: 'ok',
    });

    const { recreateSessionSandbox } = await import('./sandbox-session.js');
    const state = await recreateSessionSandbox('s1', 'alpha');
    expect(containers.stopSandboxContainer).toHaveBeenCalled();
    expect(containers.createSandboxContainer).toHaveBeenCalled();
    expect(state.status).toBe('running');
  });

  it('sessionSandboxEnabled is opt-in', async () => {
    const { sessionSandboxEnabled } = await import('./sandbox-session.js');
    expect(sessionSandboxEnabled()).toBe(false);
    process.env.CARINA_SANDBOX_SESSION = 'true';
    expect(sessionSandboxEnabled()).toBe(true);
  });
});
