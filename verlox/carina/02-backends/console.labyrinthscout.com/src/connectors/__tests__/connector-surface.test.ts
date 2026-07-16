import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readSource(name: string): string {
  return readFileSync(resolve(process.cwd(), 'src', name), 'utf8');
}

describe('connector surface', () => {
  it('registers connectors at server startup', () => {
    const server = readSource('server.ts');
    expect(server).toContain("import './connectors/register-all.js'");
  });

  it('runs connector schema migration from migrations.ts', () => {
    const migrations = readSource('migrations.ts');
    expect(migrations).toContain('runConnectorSchemaMigration');
  });

  it('mounts connectors API under admin router', () => {
    const admin = readSource('api/admin.ts');
    expect(admin).toContain("adminRouter.use('/connectors', connectorsRouter)");
  });

  it('routes alert dispatcher output to connector router', () => {
    const dispatcher = readSource('alerts/dispatcher.ts');
    expect(dispatcher).toContain('getConnectorRouter');
    expect(dispatcher).toContain('pushFromSecurityEvent');
  });
});
