import { describe, expect, it } from 'vitest';
import { AIVA_WORKER_TABS, parseAivaWorkerTab } from './aiva-worker-tabs';

describe('aiva worker tabs', () => {
  it('accepts known tabs case-insensitively', () => {
    expect(parseAivaWorkerTab(' Oversight ')).toBe('oversight');
    expect(parseAivaWorkerTab('tasks')).toBe('tasks');
  });

  it('defaults unknown values to chat', () => {
    expect(parseAivaWorkerTab('unknown')).toBe('chat');
    expect(parseAivaWorkerTab(null)).toBe('chat');
    expect(AIVA_WORKER_TABS.map((tab) => tab.id)).toContain('settings');
  });
});
