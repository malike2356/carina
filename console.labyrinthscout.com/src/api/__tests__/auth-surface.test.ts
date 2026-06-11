import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

function readSource(relative: string): string {
  return fs.readFileSync(path.join(ROOT, relative), 'utf-8');
}

describe('HTTP auth surface', () => {
  it('requires API key on control-plane routes in Scout server', () => {
    const server = readSource('server.ts');
    expect(server).toContain("app.use('/api/events', requireApiKey");
    expect(server).toContain("app.use('/api/kill', requireApiKey");
    expect(server).toContain("app.use('/api/public/trust', publicTrustRouter)");
    expect(server).not.toMatch(/app\.use\('\/api\/kill',\s*killRouter\)/);
  });

  it('keeps public trust router read-only', () => {
    const router = readSource('api/public-trust.ts');
    expect(router).toContain('read-only');
    expect(router).toContain("req.method === 'GET'");
  });

  it('exposes operator readiness without API key', () => {
    const server = readSource('server.ts');
    expect(server).toContain("app.use('/api/readiness', readinessRouter)");
    expect(server).not.toContain("app.use('/api/readiness', requireApiKey");
  });
});
