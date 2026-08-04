import { describe, expect, it } from 'vitest';
import { parseAivaWorkerTab } from './aiva-worker-tabs';

describe('parseAivaWorkerTab', () => {
  it('defaults to chat', () => {
    expect(parseAivaWorkerTab(undefined)).toBe('chat');
    expect(parseAivaWorkerTab('')).toBe('chat');
    expect(parseAivaWorkerTab('nope')).toBe('chat');
  });

  it('accepts known worker tabs', () => {
    expect(parseAivaWorkerTab('oversight')).toBe('oversight');
    expect(parseAivaWorkerTab('Settings')).toBe('settings');
    expect(parseAivaWorkerTab('tools')).toBe('tools');
  });
});
