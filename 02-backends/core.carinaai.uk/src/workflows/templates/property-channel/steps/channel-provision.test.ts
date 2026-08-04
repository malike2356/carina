import { beforeEach, describe, expect, it, vi } from 'vitest';

const getOrVerifyChannel = vi.fn();
const updateChannelBranding = vi.fn();
const listConnectedChannels = vi.fn();

vi.mock('../../../../connectors/youtube/channel.js', () => ({
  getOrVerifyChannel: (...args: unknown[]) => getOrVerifyChannel(...args),
  updateChannelBranding: (...args: unknown[]) => updateChannelBranding(...args),
}));

vi.mock('../../../../connectors/youtube/token-store.js', () => ({
  listConnectedChannels: (...args: unknown[]) => listConnectedChannels(...args),
}));

vi.mock('../../../../connectors/youtube/client.js', () => ({
  createYouTubeClient: (workspaceId: string, channelId: string) => ({ workspaceId, channelId }),
}));

describe('property channel step: channel-provision', () => {
  beforeEach(() => {
    getOrVerifyChannel.mockReset();
    updateChannelBranding.mockReset();
    listConnectedChannels.mockReset();
  });

  it('returns awaiting_oauth when no channel is connected and none was provided', async () => {
    listConnectedChannels.mockReturnValue([]);
    const { checkOrProvisionChannel } = await import('./channel-provision.js');

    const result = await checkOrProvisionChannel({
      id: 'run-1',
      workspaceId: 'ws-1',
      input: { workspaceId: 'ws-1', niche: 'buy-to-let-investment', location: 'Leeds', publishTime: '18:30' },
    } as never);

    expect(result.status).toBe('awaiting_oauth');
    expect(getOrVerifyChannel).not.toHaveBeenCalled();
  });

  it('verifies and brands the channel once connected, and only calls the API once per run', async () => {
    listConnectedChannels.mockReturnValue([{ channelId: 'chan-1' }]);
    getOrVerifyChannel.mockResolvedValue({ id: 'chan-1', title: 'Old Title', description: '' });
    updateChannelBranding.mockResolvedValue(undefined);

    const { checkOrProvisionChannel } = await import('./channel-provision.js');
    const run = {
      id: 'run-1',
      workspaceId: 'ws-1',
      input: { workspaceId: 'ws-1', niche: 'buy-to-let-investment', location: 'Leeds', publishTime: '18:30' },
    } as never;

    const result = await checkOrProvisionChannel(run);
    expect(result.status).toBe('connected');
    if (result.status === 'connected') {
      expect(result.output.channelId).toBe('chan-1');
      expect(result.output.channelTitle).toContain('Leeds');
    }
    expect(getOrVerifyChannel).toHaveBeenCalledTimes(1);
    expect(updateChannelBranding).toHaveBeenCalledTimes(1);
  });

  it('skips branding when the channel already has the desired title', async () => {
    listConnectedChannels.mockReturnValue([{ channelId: 'chan-1' }]);
    getOrVerifyChannel.mockResolvedValue({ id: 'chan-1', title: 'Leeds Buy To Let Investment Insider', description: '' });

    const { checkOrProvisionChannel } = await import('./channel-provision.js');
    const run = {
      id: 'run-1',
      workspaceId: 'ws-1',
      input: { workspaceId: 'ws-1', niche: 'buy-to-let-investment', location: 'Leeds', publishTime: '18:30' },
    } as never;

    await checkOrProvisionChannel(run);
    expect(updateChannelBranding).not.toHaveBeenCalled();
  });
});
