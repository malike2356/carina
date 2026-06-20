import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

function readSource(relative: string): string {
  return fs.readFileSync(path.join(ROOT, relative), 'utf-8');
}

describe('compliance SOC visibility surface', () => {
  it('registers public compliance routes without API key', () => {
    const server = readSource('server.ts');
    expect(server).toContain("app.use('/api/public/compliance', compliancePublicRouter)");
    expect(server).not.toContain("app.use('/api/public/compliance', requireApiKey");
  });

  it('runs compliance visibility migration', () => {
    const migrations = readSource('migrations.ts');
    expect(migrations).toContain('runComplianceVisibilityMigration');
  });

  it('schedules weekly compliance digest', () => {
    const scheduler = readSource('scheduler.ts');
    expect(scheduler).toContain('sendComplianceDigest');
    expect(scheduler).toContain('startComplianceDigestScheduler');
  });
});
