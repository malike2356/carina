import { describe, expect, it, vi } from 'vitest';
import { buildCommandList, resolveCommand } from './registry.js';

describe('playbook rename (user-facing CLI)', () => {
  it('registers playbook as the primary command', () => {
    const playbook = resolveCommand('playbook');
    expect(playbook).toBeDefined();
    expect(playbook?.usage).toContain('carina playbook');
  });

  it('keeps cookbook as a deprecated alias', () => {
    const cookbook = resolveCommand('cookbook');
    expect(cookbook).toBeDefined();
    expect(cookbook?.usage).toContain('deprecated');
    expect(cookbook?.usage).toContain('playbook');
  });

  it('lists playbook before cookbook in command help order', () => {
    const names = buildCommandList().map((c) => c.name);
    const playbookIdx = names.indexOf('playbook');
    const cookbookIdx = names.indexOf('cookbook');
    expect(playbookIdx).toBeGreaterThanOrEqual(0);
    expect(cookbookIdx).toBeGreaterThanOrEqual(0);
    expect(playbookIdx).toBeLessThan(cookbookIdx);
  });

  it('cookbook handler prints deprecation notice', async () => {
    const cookbook = resolveCommand('cookbook');
    expect(cookbook?.handler).toBeDefined();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      await cookbook!.handler!([]);
    } catch {
      // runCookbookDefault may throw without hardware catalog; deprecation must still print
    }
    expect(warn).toHaveBeenCalled();
    const message = warn.mock.calls.map((call) => String(call[0])).join(' ');
    expect(message).toMatch(/carina cookbook is now carina playbook/i);
    warn.mockRestore();
    log.mockRestore();
  });
});
