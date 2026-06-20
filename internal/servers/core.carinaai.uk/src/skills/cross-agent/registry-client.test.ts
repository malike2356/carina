import { describe, expect, it } from 'vitest';
import { getFormatRegistryClient, _resetFormatRegistryClientForTests } from './registry-client.js';

describe('format registry client', () => {
  it('loads bundled formats', async () => {
    _resetFormatRegistryClientForTests();
    const client = getFormatRegistryClient();
    await client.ensureLoaded();
    const formats = client.listFormats();
    expect(formats.length).toBeGreaterThanOrEqual(14);
    expect(client.getFormat('cursor-rules')?.ecosystem).toBe('cursor');
  });

  it('matches registry format from content', async () => {
    _resetFormatRegistryClientForTests();
    const client = getFormatRegistryClient();
    const match = client.matchFormat(
      'You are an expert in TypeScript.\n',
      'project.cursorrules',
    );
    expect(match?.format).toBe('cursor-rules');
  });
});
