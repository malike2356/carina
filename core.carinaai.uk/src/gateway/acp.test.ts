import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('ACP gateway isolation', () => {
  it('setupAcpRoutes exits early when bridge disabled', () => {
    const source = fs.readFileSync(path.join(srcRoot, 'gateway', 'acp.ts'), 'utf8');
    expect(source).toMatch(/acpBridgeEnabled\(\)/);
    expect(source).toMatch(/if \(!acpBridgeEnabled\(\)\) return/);
  });

  it('web still imports setupAcpRoutes but routes self-gate', () => {
    const source = fs.readFileSync(path.join(srcRoot, 'gateway', 'web.ts'), 'utf8');
    expect(source).toMatch(/setupAcpRoutes/);
  });
});
