import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Aiva worker spreadsheet delivery UI', () => {
  it('offers Excel by default and CSV as an option', () => {
    const source = readFileSync(new URL('./AivaWorkerDirectChat.tsx', import.meta.url), 'utf8');
    expect(source).toContain('Download Excel');
    expect(source).toContain('Download CSV');
    expect(source).toContain('downloadExcel');
    expect(source).toContain('downloadCsv');
    expect(source).toContain('|ods');
  });
});
