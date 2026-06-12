import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleGatewayCommand } from '../gateway/commands.js';

const here = dirname(fileURLToPath(import.meta.url));
const coreRoot = join(here, '../..');
const repoRoot = join(coreRoot, '..');
const docsRoot = join(repoRoot, 'docs.carinaai.uk');

const GUIDE_PAGES = [
  'docs/user/getting-started.md',
  'docs/user/tools/overview.md',
  'docs/user/carina-cloud.md',
  'docs/user/gateways/cli.md',
  'docs/developer/intro.md',
];

describe('release docs alignment', () => {
  it('gateway /help links to the canonical capability inventory URL', () => {
    const result = handleGatewayCommand('/help');
    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(result.reply).toContain('https://carinaai.uk/docs/capabilities');
    expect(result.reply).toContain('/help - show this message');
  });

  it('public docs site publishes capability inventory at /capabilities slug', () => {
    const docPath = join(docsRoot, 'docs/user/capability-inventory.md');
    const raw = readFileSync(docPath, 'utf8');
    expect(raw).toContain('slug: /capabilities');
    expect(raw).toMatch(/single authoritative page/i);
    expect(raw).toMatch(/51 providers|51 LLM providers/i);
  });

  it('docs navbar and footer link to the capability inventory', () => {
    const config = readFileSync(join(docsRoot, 'docusaurus.config.ts'), 'utf8');
    expect(config).toContain("docId: 'user/capability-inventory'");
    expect(config).toMatch(/Capability inventory|capabilities/);
  });

  it('docs sidebar lists capability inventory in Getting started', () => {
    const sidebars = readFileSync(join(docsRoot, 'sidebars.ts'), 'utf8');
    expect(sidebars).toContain("'user/capability-inventory'");
    expect(sidebars.indexOf('user/capability-inventory')).toBeLessThan(
      sidebars.indexOf('user/getting-started'),
    );
  });

  it('major guides point to the canonical inventory', () => {
    for (const rel of GUIDE_PAGES) {
      const raw = readFileSync(join(docsRoot, rel), 'utf8');
      expect(raw, rel).toMatch(/\/docs\/capabilities|Capability inventory/i);
    }
  });

  it('hosted billing uses config.hosted.freeDailyMessages for free tier cap', () => {
    const src = readFileSync(join(coreRoot, 'src/api/hosted-billing.ts'), 'utf8');
    expect(src).toContain('config.hosted.freeDailyMessages');
    expect(src).not.toMatch(/freeDailyLimit: plan === 'free' \? 50/);
  });

  it('npm package version is semver and matches README badge pattern', () => {
    const pkg = JSON.parse(readFileSync(join(coreRoot, 'package.json'), 'utf8')) as { version: string };
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
    const readme = readFileSync(join(coreRoot, 'README.md'), 'utf8');
    expect(readme).toContain('carina-agent');
    expect(readme).toMatch(/npm install -g carina-agent|npx carina-agent/);
  });

  it('operator capability doc points to public canonical page', () => {
    const inv = readFileSync(join(coreRoot, 'docs/capabilities.md'), 'utf8');
    expect(inv).toMatch(/carinaai\.uk\/docs\/capabilities/);
    expect(inv).not.toMatch(/## Built-in tools/);
  });

  it('marketing homepage links to canonical capability inventory', () => {
    const home = readFileSync(join(repoRoot, 'carinaai.uk/index.html'), 'utf8');
    expect(home).toContain('https://carinaai.uk/docs/capabilities');
    expect(home).toMatch(/when configured|toolset-dependent/i);
  });
});
