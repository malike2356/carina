import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/channel-config-api.js', () => ({
  getConfiguredChannels: vi.fn(),
  saveChannelConfiguration: vi.fn(),
  removeChannelConfiguration: vi.fn(),
  testChannelConfiguration: vi.fn(),
}));

import {
  getConfiguredChannels,
  saveChannelConfiguration,
  testChannelConfiguration,
} from '../api/channel-config-api.js';
import { channelConfigTool } from './channel-config-tool.js';

const getConfiguredChannelsMock = vi.mocked(getConfiguredChannels);
const saveChannelConfigurationMock = vi.mocked(saveChannelConfiguration);
const testChannelConfigurationMock = vi.mocked(testChannelConfiguration);

describe('channelConfigTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists channels with configured status', async () => {
    getConfiguredChannelsMock.mockResolvedValue([
      {
        channelId: 'telegram',
        status: 'configured',
        requiresRestart: false,
        testedAt: null,
      },
    ] as never);

    const result = await channelConfigTool.execute({ action: 'list' });
    expect(result.action).toBe('list');
    expect(result.summary).toContain('1 channel');
    const telegram = (result.channels as Array<{ id: string; configured: boolean }>).find(
      (c) => c.id === 'telegram',
    );
    expect(telegram?.configured).toBe(true);
  });

  it('returns requirements for telegram with nextField bot_token only', async () => {
    const result = await channelConfigTool.execute({
      action: 'requirements',
      channel_id: 'tg',
    });
    expect(result.action).toBe('requirements');
    expect(result.channelId).toBe('telegram');
    expect(result.nextField).toMatchObject({ key: 'bot_token', sensitive: true });
    expect(JSON.stringify(result)).not.toMatch(/sk-live|real-secret/i);
  });

  it('configure without credentials returns needs_credentials', async () => {
    const result = await channelConfigTool.execute({
      action: 'configure',
      channel_id: 'telegram',
    });
    expect(result.status).toBe('needs_credentials');
    expect(result.requiredFields).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'bot_token' })]),
    );
    expect(saveChannelConfigurationMock).not.toHaveBeenCalled();
  });

  it('configure with token saves and does not echo the secret', async () => {
    saveChannelConfigurationMock.mockResolvedValue({
      ok: true,
      requiresRestart: true,
    } as never);

    const secret = '123456789:LIVESECRETTOKENVALUEHERE99';
    const result = await channelConfigTool.execute({
      action: 'configure',
      channel_id: 'telegram',
      credentials: { bot_token: secret },
    });

    expect(result.success).toBe(true);
    expect(saveChannelConfigurationMock).toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it('test delegates to probe helper', async () => {
    testChannelConfigurationMock.mockResolvedValue({
      success: true,
      message: 'ok',
    } as never);

    const result = await channelConfigTool.execute({
      action: 'test',
      channel_id: 'telegram',
    });
    expect(testChannelConfigurationMock).toHaveBeenCalledWith('telegram', null);
    expect(result).toMatchObject({ action: 'test' });
  });
});
