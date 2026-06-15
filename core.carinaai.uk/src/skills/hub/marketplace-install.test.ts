import fs from 'fs/promises';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveCarinaHome } from '../../config/paths.js';

vi.mock('../../cli/commands/pack/install.js', () => ({
  installPackSlug: vi.fn().mockResolvedValue({ name: 'demo-pack', version: '9.9.9', dest: '/tmp', upgraded: true }),
}));

describe('marketplace install flow', () => {
  const home = resolveCarinaHome();

  beforeEach(async () => {
    await fs.mkdir(home, { recursive: true });
    await fs.rm(path.join(home, 'marketplace.json'), { force: true });
  });

  afterEach(async () => {
    await fs.rm(path.join(home, 'marketplace'), { recursive: true, force: true });
    await fs.rm(path.join(home, 'marketplace.json'), { force: true });
  });

  it('installs workflow and theme assets locally', async () => {
    const { marketplaceInstall } = await import('./marketplace-install.js');
    const wf = await marketplaceInstall('workflow:morning-briefing');
    expect(wf.status).toBe('installed');
    const theme = await marketplaceInstall('theme:tui-operator');
    expect(theme.status).toBe('installed');

    const wfFile = path.join(home, 'marketplace', 'workflows', 'morning-briefing.json');
    const themeFile = path.join(home, 'marketplace', 'themes', 'tui-operator.json');
    await expect(fs.access(wfFile)).resolves.toBeUndefined();
    await expect(fs.access(themeFile)).resolves.toBeUndefined();
  });

  it('enables and disables toolset entries', async () => {
    const { marketplaceInstall, marketplaceEnable, marketplaceDisable } = await import('./marketplace-install.js');
    await marketplaceInstall('toolset:utilities');
    const enabled = await marketplaceEnable('toolset:utilities');
    expect(enabled.status).toBe('enabled');
    const disabled = await marketplaceDisable('toolset:utilities');
    expect(disabled.status).toBe('disabled');
  });

  it('installs pack via pack installer', async () => {
    const { marketplaceInstall } = await import('./marketplace-install.js');
    const { installPackSlug } = await import('../../cli/commands/pack/install.js');
    const result = await marketplaceInstall('pack:operator-daily', { bypassEval: true });
    expect(result.message).toContain('operator-daily');
    expect(vi.mocked(installPackSlug)).toHaveBeenCalled();
  });
});
