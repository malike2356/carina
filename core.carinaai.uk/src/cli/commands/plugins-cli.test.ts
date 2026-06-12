import { describe, expect, it, vi } from 'vitest';

vi.mock('./extensions-cli.js', () => ({
  runExtensionsCommand: vi.fn(async () => undefined),
}));

describe('plugins-cli alias', () => {
  it('delegates list to extensions list', async () => {
    const { runPluginsCommand } = await import('./plugins-cli.js');
    const { runExtensionsCommand } = await import('./extensions-cli.js');
    await runPluginsCommand(['list']);
    expect(runExtensionsCommand).toHaveBeenCalledWith(['list']);
  });

  it('delegates install with args', async () => {
    const { runPluginsCommand } = await import('./plugins-cli.js');
    const { runExtensionsCommand } = await import('./extensions-cli.js');
    vi.mocked(runExtensionsCommand).mockClear();
    await runPluginsCommand(['install', '/tmp/bundle']);
    expect(runExtensionsCommand).toHaveBeenCalledWith(['install', '/tmp/bundle']);
  });
});
