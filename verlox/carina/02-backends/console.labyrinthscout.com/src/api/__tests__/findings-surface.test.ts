import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

function readSource(relative: string): string {
  return fs.readFileSync(path.join(ROOT, relative), 'utf-8');
}

describe('findings HTTP surface', () => {
  it('registers findings routes behind API key and Scout Pro gate', () => {
    const server = readSource('server.ts');
    expect(server).toContain("app.use('/api/targets', requireApiKey, requireScoutPro, targetsRouter)");
    expect(server).toContain("app.use('/api/findings', requireApiKey, requireScoutPro, findingsRouter)");
    expect(server).toContain("app.use('/api/scans', requireApiKey, requireScoutPro, scansRouter)");
    expect(server).toContain("app.use('/api/score', requireApiKey, requireScoutPro, scoutScoreRouter)");
  });

  it('runs findings schema migration from migrations.ts', () => {
    const migrations = readSource('migrations.ts');
    expect(migrations).toContain('runFindingsSchemaMigration');
  });
});
