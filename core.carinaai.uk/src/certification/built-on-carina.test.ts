import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { evaluateBuiltOnCarina } from './built-on-carina.js';

describe('built-on-carina certification', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-cert-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('passes for a domain pack project', () => {
    fs.writeFileSync(path.join(tmpDir, 'pack.json'), JSON.stringify({
      name: 'demo',
      version: '1.0.0',
      description: 'Demo pack',
      author: 'Test Org',
    }));
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Demo\n\nBuilt on Carina kernel.\n');
    const report = evaluateBuiltOnCarina(tmpDir);
    expect(report.checks.some((c) => c.id === 'kernel.integration' && c.passed)).toBe(true);
  });
});
