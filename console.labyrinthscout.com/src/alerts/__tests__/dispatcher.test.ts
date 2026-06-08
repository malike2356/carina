import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SecurityEvent } from '../types.js';

const queryMock = vi.fn();
const incrMock = vi.fn();
const expireMock = vi.fn();

vi.mock('../../db.js', () => ({
  pool: { query: (...args: unknown[]) => queryMock(...args) },
}));

vi.mock('../../redis.js', () => ({
  getRedis: () => ({
    incr: incrMock,
    expire: expireMock,
  }),
}));

function makeEvent(overrides: Partial<SecurityEvent> = {}): SecurityEvent {
  return {
    id: 'evt-1',
    instance_id: 'carina-local',
    session_id: 'session-1',
    event_type: 'injection_blocked',
    severity: 'critical',
    description: 'Prompt injection attempt blocked',
    created_at: new Date('2026-06-04T12:00:00.000Z'),
    ...overrides,
  };
}

function telegramChannel(threshold: SecurityEvent['severity'] = 'warning') {
  return {
    id: 'ch-telegram',
    channel_type: 'telegram' as const,
    severity_threshold: threshold,
    enabled: true,
    config: { chat_id: '12345' },
  };
}

function slackChannel(threshold: SecurityEvent['severity'] = 'warning') {
  return {
    id: 'ch-slack',
    channel_type: 'slack' as const,
    severity_threshold: threshold,
    enabled: true,
    config: { webhook_url: 'https://hooks.slack.com/services/test' },
  };
}

describe('AlertDispatcher', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    queryMock.mockReset();
    incrMock.mockReset();
    expireMock.mockReset();
    incrMock.mockResolvedValue(1);
    expireMock.mockResolvedValue(1);
    process.env.SCOUT_TELEGRAM_BOT_TOKEN = 'test-bot-token';
    process.env.SCOUT_SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/test';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, text: async () => 'ok' }),
    );
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it('dispatches critical event to channels with threshold <= critical', async () => {
    queryMock.mockResolvedValueOnce({ rows: [telegramChannel('warning')] });
    const fetchMock = vi.mocked(fetch);

    const { alertDispatcher } = await import('../dispatcher.js');
    await alertDispatcher.dispatch(makeEvent({ severity: 'critical' }));

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('api.telegram.org');
  });

  it('does not dispatch info event to channel with threshold=warning', async () => {
    queryMock.mockResolvedValueOnce({ rows: [telegramChannel('warning')] });
    const fetchMock = vi.mocked(fetch);

    const { alertDispatcher } = await import('../dispatcher.js');
    await alertDispatcher.dispatch(makeEvent({ severity: 'info' }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('dispatches to remaining channels when one adapter throws', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [telegramChannel('warning'), slackChannel('warning')],
    });

    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('Telegram down'))
      .mockResolvedValueOnce({ ok: true, text: async () => 'ok' });
    vi.stubGlobal('fetch', fetchMock);

    const { alertDispatcher } = await import('../dispatcher.js');
    await alertDispatcher.dispatch(makeEvent({ severity: 'critical' }));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('hooks.slack.com');
  });

  it('suppresses 4th alert in 5-minute window via Redis dedup', async () => {
    queryMock.mockResolvedValueOnce({ rows: [telegramChannel('warning')] });
    incrMock.mockResolvedValue(4);
    const fetchMock = vi.mocked(fetch);

    const { alertDispatcher } = await import('../dispatcher.js');
    await alertDispatcher.dispatch(makeEvent({ severity: 'critical' }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('runs silently when no channels are configured', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const fetchMock = vi.mocked(fetch);

    const { alertDispatcher } = await import('../dispatcher.js');
    await expect(alertDispatcher.dispatch(makeEvent())).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('dispatches breach events to channels with info threshold', async () => {
    queryMock.mockResolvedValueOnce({ rows: [telegramChannel('info')] });
    const fetchMock = vi.mocked(fetch);

    const { alertDispatcher } = await import('../dispatcher.js');
    await alertDispatcher.dispatch(makeEvent({ severity: 'breach' }));

    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe('TelegramAdapter.formatMessage', () => {
  it('prepends breach prefix for breach severity events', async () => {
    const { TelegramAdapter } = await import('../telegram.js');
    const adapter = new TelegramAdapter();
    const text = adapter.formatMessage(
      makeEvent({ severity: 'breach', event_type: 'honeypot_triggered' }),
    );
    expect(text).toContain('*BREACH DETECTED*');
    expect(text).toContain('LABYRINTH BREACH -- honeypot_triggered');
  });

  it('truncates description longer than 300 chars', async () => {
    const { TelegramAdapter } = await import('../telegram.js');
    const adapter = new TelegramAdapter();
    const longDescription = 'x'.repeat(350);
    const text = adapter.formatMessage(makeEvent({ description: longDescription }));
    expect(text).toContain('x'.repeat(297) + '...');
    expect(text).not.toContain('x'.repeat(350));
  });
});
