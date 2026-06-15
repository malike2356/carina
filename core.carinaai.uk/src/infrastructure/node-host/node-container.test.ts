import { describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('node-container', () => {
  it('uses hardened docker run profile', async () => {
    const source = await fs.readFile(path.join(here, 'node-container.ts'), 'utf8');
    expect(source).toContain("'run', '--rm'");
    expect(source).toContain('--network=none');
    expect(source).toContain('--read-only');
    expect(source).toContain('--cap-drop=ALL');
    expect(source).toContain('--security-opt=no-new-privileges');
  });
});
