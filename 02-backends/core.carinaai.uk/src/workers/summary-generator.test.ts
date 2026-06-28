import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Worker } from '../types/index.js';

vi.mock('../memory/db.js', () => ({
  pool: { query: vi.fn(async () => ({ rows: [] })) },
}));

vi.mock('croner', () => ({
  Cron: vi.fn(() => ({ stop: vi.fn() })),
}));

vi.mock('./worker-store.js', () => ({
  logActivity: vi.fn(async () => {}),
  getWorkerById: vi.fn(async () => null),
}));

vi.mock('./aiva-feature-flags.js', () => ({
  isPropreneurBridgeEnabled: () => false,
  isAivaDailySummaryEnabled: () => false,
}));

vi.mock('./worker-bridge-store.js', () => ({
  resolvePropreneurBinding: () => null,
  listWorkersWithSummaryEnabled: async () => [],
}));

vi.mock('../ingestion/email/email-connection-store.js', () => ({
  listRecentDigests: async () => [],
}));

vi.mock('../channels/channel-store.js', () => ({
  listWorkerChannelDetails: async () => [],
  readChannelCredentials: () => ({}),
}));

vi.mock('../channels/adapter-registry.js', () => ({
  getAdapter: () => null,
}));

vi.mock('../channels/worker-registry.js', () => ({
  lookupWorker: () => null,
}));

vi.mock('./summary-tts.js', () => ({
  synthesizeSummaryAudio: vi.fn(async () => ({
    filePath: '/tmp/test-summary.mp3',
    cleanup: async () => {},
  })),
  sendTelegramAudioFile: vi.fn(async () => {}),
  truncateSummaryForTts: (text: string) => text,
  SUMMARY_TTS_MAX_CHARS: 1500,
}));

describe('summary-generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('buildDailySummaryText returns quiet-day format when no activity', async () => {
    const { buildDailySummaryText } = await import('./summary-generator.js');
    const worker = {
      id: 'w1',
      name: 'Glen Aiva',
      workerConfig: {},
    } as Worker;

    const text = await buildDailySummaryText(worker);
    expect(text).toContain('Quiet day');
    expect(text.split('\n').length).toBeLessThanOrEqual(4);
  });

  it('workerSummaryCron prefers per-worker schedule', async () => {
    const { workerSummaryCron } = await import('./summary-generator.js');
    expect(workerSummaryCron({
      workerConfig: { summary: { summarySchedule: '30 8 * * *' } },
    } as Worker)).toBe('30 8 * * *');
  });
});
