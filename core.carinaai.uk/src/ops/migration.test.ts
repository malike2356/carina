import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('migration', () => {
  let tmpHermes: string;
  let tmpDest: string;

  beforeEach(() => {
    tmpHermes = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-src-'));
    tmpDest = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-dest-'));
    vi.stubEnv('CARINA_HOME', tmpDest);
  });

  afterEach(() => {
    fs.rmSync(tmpHermes, { recursive: true, force: true });
    fs.rmSync(tmpDest, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('migrates hermes config and labels partial skills import', async () => {
    fs.writeFileSync(path.join(tmpHermes, 'config.yaml'), 'model:\n  provider: deepseek\n  default: chat\n');
    fs.mkdirSync(path.join(tmpHermes, 'skills', 'demo'), { recursive: true });
    fs.writeFileSync(path.join(tmpHermes, 'skills', 'demo', 'SKILL.md'), '# demo\n');

    const { migrateHermes } = await import('./migration/hermes.js');
    const report = await migrateHermes(tmpHermes, tmpDest, { force: true, skipBackup: true });

    expect(report.items.some((i) => i.path === 'config.yaml' && i.status === 'imported')).toBe(true);
    expect(report.items.some((i) => i.path === 'packs' && i.status === 'partial')).toBe(true);
    expect(report.warnings.some((w) => /pack/i.test(w))).toBe(true);
    expect(report.manualFollowUp.length).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(tmpDest, 'packs', 'demo', 'SKILL.md'))).toBe(true);
  });

  it('hermes dry-run does not write files', async () => {
    fs.writeFileSync(path.join(tmpHermes, 'config.yaml'), 'model:\n  provider: deepseek\n  default: chat\n');
    const { migrateHermes } = await import('./migration/hermes.js');
    const report = await migrateHermes(tmpHermes, tmpDest, { dryRun: true });
    expect(report.dryRun).toBe(true);
    expect(fs.existsSync(path.join(tmpDest, 'config.yaml'))).toBe(false);
  });

  it('openclaw migration labels skills partial and copies config', async () => {
    fs.writeFileSync(
      path.join(tmpHermes, 'config.yaml'),
      'model:\n  provider: deepseek\n  default: chat\n',
    );
    fs.mkdirSync(path.join(tmpHermes, 'skills', 'demo'), { recursive: true });
    fs.writeFileSync(path.join(tmpHermes, 'skills', 'demo', 'SKILL.md'), '# demo\n');

    const { migrateOpenClaw } = await import('./migration/openclaw.js');
    const report = await migrateOpenClaw(tmpHermes, tmpDest, { force: true });

    expect(report.source).toBe('openclaw');
    expect(report.items.some((i) => i.path === 'config.yaml' && i.status === 'imported')).toBe(true);
    expect(report.items.some((i) => i.path === 'skills' && i.status === 'partial')).toBe(true);
    expect(report.warnings.some((w) => /pack format/i.test(w))).toBe(true);
    expect(fs.existsSync(path.join(tmpDest, 'skills', 'demo', 'SKILL.md'))).toBe(true);
  });

  it('claude migration redacts secrets and imports instructions', async () => {
    const claudeDir = path.join(tmpHermes, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'settings.json'),
      JSON.stringify({
        apiKey: 'secret-key-value',
        theme: 'dark',
        mcpServers: { demo: { command: 'node', args: ['server.js'], env: { TOKEN: 'abc' } } },
      }),
    );
    fs.writeFileSync(path.join(claudeDir, 'CLAUDE.md'), '# Instructions\n');

    const { migrateClaude } = await import('./migration/claude.js');
    const report = await migrateClaude(tmpDest, claudeDir, { force: true });

    expect(report.sourceDir).toContain('.claude');
    const imported = path.join(tmpDest, 'resources', 'claude-import', 'settings.json');
    expect(fs.existsSync(imported)).toBe(true);
    const raw = fs.readFileSync(imported, 'utf-8');
    expect(raw).not.toContain('secret-key-value');
    expect(raw).toContain('redacted-by-carina-migrate');
    expect(fs.existsSync(path.join(tmpDest, 'personality.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDest, 'resources', 'claude-import', 'mcp-servers.json'))).toBe(true);
    const mcp = JSON.parse(fs.readFileSync(path.join(tmpDest, 'resources', 'claude-import', 'mcp-servers.json'), 'utf-8'));
    expect(mcp.servers.some((s: { name: string }) => s.name === 'demo')).toBe(true);
  });

  it('export/import round-trip preserves config', async () => {
    fs.writeFileSync(path.join(tmpDest, 'config.yaml'), 'provider: deepseek\nmodel: chat\n');
    fs.mkdirSync(path.join(tmpDest, 'packs', 'demo'), { recursive: true });
    fs.writeFileSync(path.join(tmpDest, 'packs', 'demo', 'SKILL.md'), '# x\n');

    const { exportCarinaBundle, importCarinaBundle } = await import('./migration/interop-bundle.js');
    const exported = await exportCarinaBundle({ homeDir: tmpDest, label: 'roundtrip' });
    expect(fs.existsSync(path.join(exported.path, 'interop-manifest.json'))).toBe(true);

    const importHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-import-'));
    try {
      const result = await importCarinaBundle(exported.path, { destDir: importHome, force: true });
      expect(result.restored).toContain('config.yaml');
      expect(fs.existsSync(path.join(importHome, 'packs', 'demo', 'SKILL.md'))).toBe(true);
    } finally {
      fs.rmSync(importHome, { recursive: true, force: true });
    }
  });

  it('scanMigrationSources returns found flag', async () => {
    const { scanMigrationSources } = await import('./migration/index.js');
    const scans = await scanMigrationSources();
    expect(Array.isArray(scans)).toBe(true);
    expect(scans.some((s) => s.source === 'hermes')).toBe(true);
    expect(scans.some((s) => s.source === 'claude')).toBe(true);
  });

  it('formatMigrationReport includes manual follow-up', async () => {
    const { formatMigrationReport } = await import('./migration/index.js');
    const text = formatMigrationReport({
      version: 1,
      source: 'hermes',
      sourceDir: '/tmp/h',
      destDir: '/tmp/d',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      items: [{ path: 'packs', status: 'partial' }],
      warnings: ['warn'],
      manualFollowUp: ['do something'],
      dryRun: false,
    });
    expect(text).toContain('Manual follow-up');
    expect(text).toContain('do something');
  });
});

describe('migration runtime isolation', () => {
  it('orchestrator does not import migration modules', () => {
    const srcRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
    const src = fs.readFileSync(path.join(srcRoot, 'agents', 'orchestrator.ts'), 'utf-8');
    expect(src.includes('migration/')).toBe(false);
    expect(src.includes('migrateHermes')).toBe(false);
  });
});
