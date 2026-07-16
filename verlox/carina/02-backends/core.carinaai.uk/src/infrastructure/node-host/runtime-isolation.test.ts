import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('node-host runtime isolation', () => {
  it('orchestrator does not import node-host daemon', async () => {
    const source = await fs.readFile(path.join(srcRoot, 'agents', 'orchestrator.ts'), 'utf8');
    expect(source).not.toMatch(/node-host\/daemon/);
    expect(source).not.toMatch(/node-host\/routes/);
  });

  it('gateway only mounts node routes when env flag is set', async () => {
    const webServerPath = path.join(srcRoot, '..', 'packages', 'web', 'src', 'web-server.ts');
    const source = await fs.readFile(webServerPath, 'utf8');
    expect(source).toMatch(/CARINA_NODE_HOST_ENABLED/);
    expect(source).toMatch(/mountNodeHostRoutes/);
  });
});
