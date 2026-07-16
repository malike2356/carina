import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spssOutputParseTool } from './spss-output-parse-tool.js';

describe('spssOutputParseTool', () => {
  let workDir = '';

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'carina-spss-parse-'));
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it('parses plain-text PSPP output into APA markdown', async () => {
    const file = join(workDir, 'output.txt');
    writeFileSync(
      file,
      `
==============================
Group Statistics
==============================
Group    N    Mean
1        10   3.2
2        12   4.1
==============================
`,
      'utf-8',
    );

    const result = await spssOutputParseTool.execute({ file });
    expect(result).toMatchObject({
      success: true,
      format: 'apa',
      markdown: expect.stringContaining('Group Statistics'),
      tableCount: expect.any(Number),
    });
  });

  it('returns error for missing file path', async () => {
    const result = await spssOutputParseTool.execute({ file: '' });
    expect(result).toMatchObject({ error: expect.stringContaining('required') });
  });
});
