import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  extractAcpRouteManifestFromSource,
  validateAcpHealthPayload,
  validateAcpIdeHealthPayload,
  validateAcpRouteManifest,
} from './acp-compliance.js';

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

describe('acp-compliance', () => {
  it('validates route manifest from source files', () => {
    const acpSource = fs.readFileSync(path.join(srcRoot, 'acp.ts'), 'utf8');
    const ideSource = fs.readFileSync(path.join(srcRoot, 'acp-ide.ts'), 'utf8');
    const manifest = extractAcpRouteManifestFromSource(acpSource, ideSource);
    const report = validateAcpRouteManifest({ ...manifest, enabled: true });
    expect(report.ok).toBe(true);
    expect(report.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });

  it('flags missing routes', () => {
    const report = validateAcpRouteManifest({ acpRoutes: ['GET /acp/health'], ideRoutes: [] });
    expect(report.ok).toBe(false);
  });

  it('validates health payloads', () => {
    const issues = validateAcpHealthPayload({ ok: true, protocol: 'acp-v1', agent: 'carina' });
    expect(issues).toHaveLength(0);
    const ideIssues = validateAcpIdeHealthPayload({ ok: true, protocol: 'acp-ide-v1', agent: 'carina' });
    expect(ideIssues).toHaveLength(0);
  });
});
