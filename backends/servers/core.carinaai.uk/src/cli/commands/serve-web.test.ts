import { describe, expect, it, vi } from 'vitest';

vi.mock('@verlox/carina-web', () => ({
  startWeb: vi.fn(async () => undefined),
  createWebServer: vi.fn(async () => ({})),
}));

describe('load-web-package', () => {
  it('returns install hint text', async () => {
    const { webInstallHint } = await import('../../gateway/load-web-package.js');
    expect(webInstallHint()).toContain('@verlox/carina-web');
  });
});

describe('serve without @verlox/carina-web', () => {
  it('core serve module uses dynamic web import', async () => {
    const source = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('./serve.ts', import.meta.url), 'utf8'),
    );
    expect(source).toContain('load-web-package');
    expect(source).not.toMatch(/import\s*\{[^}]*startWeb[^}]*\}\s*from\s*['"].*gateway\/web/);
  });

  it('core index uses dynamic web import', async () => {
    const source = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('../../index.ts', import.meta.url), 'utf8'),
    );
    expect(source).toContain('load-web-package');
    expect(source).not.toMatch(/import\s*\{[^}]*startWeb[^}]*\}\s*from\s*['"].\/gateway\/web/);
  });
});
