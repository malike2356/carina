import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleGatewayCommand, handleGatewayCommandAsync } from './commands.js';
import {
  clearSessionIdentityForTests,
  ensureSessionIdentity,
} from './session-identity-prefs.js';

const outreachMocks = vi.hoisted(() => ({
  pauseOutreach: vi.fn(),
  resumeOutreach: vi.fn(),
  getOutreachControlState: vi.fn(),
  buildWeeklyOwnerDigest: vi.fn(),
  listBookings: vi.fn(),
  outreachControlSummary: vi.fn(),
  getWorkerSessionContext: vi.fn(),
}));

vi.mock('./identity-resolver.js', () => ({
  identityLinksEnabled: () => true,
  getIdentityResolver: () => ({
    resolve: vi.fn().mockResolvedValue('usr_test'),
    getIdentities: vi.fn().mockResolvedValue([
      {
        channel: 'telegram',
        channelUserId: 'tg-1',
        displayName: '@alice',
        isPrimary: true,
      },
    ]),
    link: vi.fn().mockResolvedValue(undefined),
    resolveToChannel: vi.fn().mockResolvedValue(null),
  }),
}));

vi.mock('../workers/worker-session-context.js', () => ({
  getWorkerSessionContext: (...args: unknown[]) => outreachMocks.getWorkerSessionContext(...args),
}));

vi.mock('../outreach/index.js', () => ({
  pauseOutreach: (...args: unknown[]) => outreachMocks.pauseOutreach(...args),
  resumeOutreach: (...args: unknown[]) => outreachMocks.resumeOutreach(...args),
  getOutreachControlState: (...args: unknown[]) => outreachMocks.getOutreachControlState(...args),
  buildWeeklyOwnerDigest: (...args: unknown[]) => outreachMocks.buildWeeklyOwnerDigest(...args),
  listBookings: (...args: unknown[]) => outreachMocks.listBookings(...args),
  outreachControlSummary: (...args: unknown[]) => outreachMocks.outreachControlSummary(...args),
}));

afterEach(() => {
  clearSessionIdentityForTests();
  outreachMocks.pauseOutreach.mockReset();
  outreachMocks.resumeOutreach.mockReset();
  outreachMocks.getOutreachControlState.mockReset();
  outreachMocks.buildWeeklyOwnerDigest.mockReset();
  outreachMocks.listBookings.mockReset();
  outreachMocks.outreachControlSummary.mockReset();
  outreachMocks.getWorkerSessionContext.mockReset();
});

describe('gateway help command', () => {
  it('includes the capabilities docs link', () => {
    const result = handleGatewayCommand('/help');

    expect(result.handled).toBe(true);
    if (!result.handled) return;

    expect(result.reply).toContain('https://carinaai.uk/docs/capabilities');
    expect(result.reply).toContain('/model [provider] [model]');
    expect(result.reply).toContain('/clear - clear session memory');
  });

  it('returns compact help on telegram', () => {
    const result = handleGatewayCommand('/help', {}, { channel: 'telegram' });
    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(result.reply).toContain('/new');
    expect(result.reply).not.toContain('https://carinaai.uk/docs/capabilities');
  });

  it('handles /new and /stop actions', async () => {
    expect(handleGatewayCommand('/new').action).toBe('new_session');
    const stop = await handleGatewayCommandAsync('/stop');
    expect(stop.handled).toBe(true);
    if (stop.handled) {
      expect(stop.action).toBe('stop_turn');
    }
  });

  it('opens and searches contacts', async () => {
    const open = await handleGatewayCommandAsync('/contacts');
    expect(open.handled).toBe(true);
    if (open.handled) {
      expect(open.reply).toContain('Contacts module:');
    }

    const search = await handleGatewayCommandAsync('/contacts search Jane');
    expect(search.handled).toBe(true);
    if (search.handled) {
      expect(search.reply).toContain('Open Contacts:');
    }
  });

  it('returns status payload async', async () => {
    const result = await handleGatewayCommandAsync('/status', {
      sessionId: 'sess-abc',
      channel: 'discord',
      activeProvider: 'anthropic',
      activeModel: 'claude-sonnet-4-6',
    });
    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(result.reply).toContain('anthropic');
    expect(result.reply).toContain('Continuity:');
  });

  it('handles /plan on, status, and off', async () => {
    const ctx = { sessionId: 'sess-plan', channel: 'web' as const };
    const on = await handleGatewayCommandAsync('/plan on', ctx);
    expect(on.handled).toBe(true);
    if (on.handled) expect(on.reply).toContain('Plan mode ON');

    const status = await handleGatewayCommandAsync('/plan status', ctx);
    expect(status.handled).toBe(true);
    if (status.handled) expect(status.reply).toContain('Plan mode: ON');

    const off = await handleGatewayCommandAsync('/plan off', ctx);
    expect(off.handled).toBe(true);
    if (off.handled) expect(off.reply).toContain('Plan mode OFF');
  });

  it('handles /identity share off', async () => {
    ensureSessionIdentity('sess-id', 'usr_test', {
      channel: 'telegram',
      conversationId: 'chat-1',
    });
    const result = await handleGatewayCommandAsync('/identity share off', {
      sessionId: 'sess-id',
      channel: 'telegram',
      channelUserId: 'tg-1',
    });
    expect(result.handled).toBe(true);
    if (result.handled) {
      expect(result.reply).toContain('disabled');
    }
  });

  it('lists linked identities via /link', async () => {
    ensureSessionIdentity('sess-link', 'usr_test', {
      channel: 'telegram',
      conversationId: 'chat-1',
    });
    const result = await handleGatewayCommandAsync('/link', {
      sessionId: 'sess-link',
      channel: 'telegram',
      channelUserId: 'tg-1',
    });
    expect(result.handled).toBe(true);
    if (result.handled) {
      expect(result.reply).toContain('Linked identities');
      expect(result.reply).toContain('telegram');
    }
  });

  it('handles /outreach pause, resume, and status', async () => {
    outreachMocks.getWorkerSessionContext.mockReturnValue({
      worker: { id: 'worker-1', workspaceId: 'ws-1' },
    });
    outreachMocks.pauseOutreach.mockReturnValue({ paused: true, reason: 'owner request' });
    outreachMocks.resumeOutreach.mockReturnValue({ paused: false });
    outreachMocks.getOutreachControlState.mockReturnValue({ paused: true, reason: 'owner request' });
    outreachMocks.buildWeeklyOwnerDigest.mockReturnValue({
      followUpsDue: 2,
      staleLeads: [{ leadId: 'lead-1' }],
    });
    outreachMocks.listBookings.mockReturnValue([{ startsAt: '2026-08-04T18:00:00.000Z' }]);
    outreachMocks.outreachControlSummary.mockImplementation((state: { paused: boolean; reason?: string }) => (
      state.paused ? `Outreach paused${state.reason ? `: ${state.reason}` : ''}` : 'Outreach active'
    ));

    const paused = await handleGatewayCommandAsync('/outreach pause owner asked', {
      sessionId: 'sess-outreach',
      channel: 'telegram',
    });
    expect(paused.handled).toBe(true);
    if (paused.handled) expect(paused.reply).toContain('owner request');

    const status = await handleGatewayCommandAsync('/outreach status', {
      sessionId: 'sess-outreach',
      channel: 'telegram',
    });
    expect(status.handled).toBe(true);
    if (status.handled) expect(status.reply).toContain('follow-up digest');

    const resumed = await handleGatewayCommandAsync('/outreach resume', {
      sessionId: 'sess-outreach',
      channel: 'telegram',
    });
    expect(resumed.handled).toBe(true);
    if (resumed.handled) expect(resumed.reply).toContain('active');
  });
});
