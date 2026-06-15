import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  highestRfcNumber,
  listRfcs,
  parseRfcMeta,
  proposeRfc,
  slugifyTitle,
} from './rfc-lib.js';

const TEMPLATE = `# RFC-NNNN: Title

- Status: Draft
- Author:
- Created: YYYY-MM-DD
- Target API version: @verlox/carina-core 0.x

## Summary

One paragraph describing the proposed change.

## Motivation

Why is this change needed?

## Design

Detailed proposal.

## Drawbacks

Trade-offs.

## Alternatives

Other approaches.
`;

describe('rfc-lib', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-rfc-'));
    await fs.mkdir(path.join(tmpDir, 'docs', 'rfc'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'docs', 'rfc', '0000-template.md'), TEMPLATE);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('slugifyTitle produces kebab-case slugs', () => {
    expect(slugifyTitle('Add legal-uk pack manifest v2 fields')).toBe(
      'add-legal-uk-pack-manifest-v2-fields',
    );
  });

  it('proposeRfc allocates incremented RFC number', async () => {
    const rfcDir = path.join(tmpDir, 'docs', 'rfc');
    await fs.writeFile(
      path.join(rfcDir, '0001-existing-rfc.md'),
      '# RFC-0001: Existing\n\n- Status: Draft\n',
    );

    const result = await proposeRfc('Second RFC topic', {
      rfcDir,
      targetApiVersion: '@verlox/carina-core 0.2.0',
      created: '2026-06-14',
    });

    expect(result.number).toBe(2);
    expect(result.slug).toBe('second-rfc-topic');
    expect(result.relativePath).toBe('docs/rfc/0002-second-rfc-topic.md');

    const content = await fs.readFile(result.filePath, 'utf8');
    expect(content).toContain('# RFC-0002: Second RFC topic');
    expect(content).toContain('- Created: 2026-06-14');
    expect(content).toContain('- Target API version: @verlox/carina-core 0.2.0');
    expect(content).toContain('- Status: Draft');
  });

  it('highestRfcNumber ignores template file', async () => {
    const rfcDir = path.join(tmpDir, 'docs', 'rfc');
    expect(await highestRfcNumber(rfcDir)).toBe(0);
    await fs.writeFile(path.join(rfcDir, '0003-sample.md'), '# RFC-0003: Sample\n');
    expect(await highestRfcNumber(rfcDir)).toBe(3);
  });

  it('listRfcs returns parsed metadata', async () => {
    const rfcDir = path.join(tmpDir, 'docs', 'rfc');
    await fs.writeFile(
      path.join(rfcDir, '0001-add-tool-category.md'),
      `# RFC-0001: Add tool category

- Status: Accepted
- Author: Alex
- Created: 2026-06-01
- Target API version: @verlox/carina-core 0.2.0
`,
    );

    const rfcs = await listRfcs(rfcDir);
    expect(rfcs).toHaveLength(1);
    expect(rfcs[0]).toMatchObject({
      number: 1,
      title: 'Add tool category',
      status: 'Accepted',
      author: 'Alex',
      targetApiVersion: '@verlox/carina-core 0.2.0',
    });
  });

  it('parseRfcMeta extracts header fields', () => {
    const meta = parseRfcMeta(
      `# RFC-0042: Widget API

- Status: Draft
- Author: Sam
- Created: 2026-06-14
- Target API version: @verlox/carina-core 0.3.0
`,
      '0042-widget-api.md',
    );
    expect(meta.status).toBe('Draft');
    expect(meta.author).toBe('Sam');
    expect(meta.number).toBe(42);
  });
});
