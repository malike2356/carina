import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkerChannelRow } from './types.js';

const mocks = vi.hoisted(() => ({
  createWorkerChannel: vi.fn(),
  registerChannel: vi.fn(),
  registerTelegramWebhook: vi.fn(),
  getWorker: vi.fn(),
  assertCanAddConnectedChannel: vi.fn(),
}));

vi.mock('./channel-store.js', () => ({
  createWorkerChannel: mocks.createWorkerChannel,
  generateEmailSlug: () => 'selorm-123456@inbox.hireaiva.co.uk',
}));

vi.mock('./worker-registry.js', () => ({
  registerChannel: mocks.registerChannel,
}));

vi.mock('./adapters/telegram-adapter.js', () => ({
  registerTelegramWebhook: mocks.registerTelegramWebhook,
}));

vi.mock('./adapters/sms-adapter.js', () => ({
  normalizeSmsNumber: (value: string) => value.replace(/\D/g, ''),
}));

vi.mock('./adapters/discord-gateway.js', () => ({
  ensureDiscordGateway: vi.fn(),
  resolveDiscordApplicationId: vi.fn(),
}));

vi.mock('./social-channel-utils.js', () => ({
  isSocialAivaChannel: () => false,
  socialCredentialsComplete: () => false,
}));

vi.mock('../workers/worker-store.js', () => ({
  getWorker: mocks.getWorker,
}));

vi.mock('../billing/aiva-plan-gates.js', () => ({
  assertCanAddConnectedChannel: mocks.assertCanAddConnectedChannel,
}));

describe('connectWorkerChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getWorker.mockResolvedValue({
      id: 'worker-1',
      workspaceId: 'workspace-1',
      name: 'Selorm',
    });
    mocks.assertCanAddConnectedChannel.mockResolvedValue({
      allowed: true,
      limit: 20,
      connected: 1,
      planTier: 'team',
    });
    mocks.createWorkerChannel.mockImplementation(async (input: Record<string, unknown>) => ({
      id: 'channel-1',
      workerId: input.workerId,
      workspaceId: input.workspaceId,
      channel: input.channel,
      identifier: input.identifier,
      credentials: { encrypted: 'encrypted-secret' },
      enabled: true,
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }) as WorkerChannelRow);
  });

  it('connects Telegram by registering the webhook and live registry entry', async () => {
    const { connectWorkerChannel } = await import('./worker-channel-connect.js');

    const row = await connectWorkerChannel({
      workspaceId: 'workspace-1',
      workerId: 'worker-1',
      channel: 'telegram',
      credentials: { bot_token: '123456789:ABCdef_1234567890-token' },
    });

    expect(mocks.registerTelegramWebhook).toHaveBeenCalledWith(
      '123456789:ABCdef_1234567890-token',
      'worker-1',
    );
    expect(mocks.createWorkerChannel).toHaveBeenCalledWith(expect.objectContaining({
      workerId: 'worker-1',
      workspaceId: 'workspace-1',
      channel: 'telegram',
      identifier: 'worker-1',
      credentials: { bot_token: '123456789:ABCdef_1234567890-token' },
    }));
    expect(mocks.registerChannel).toHaveBeenCalledWith('telegram', 'worker-1', {
      workerId: 'worker-1',
      workspaceId: 'workspace-1',
      channelRowId: 'channel-1',
      credentialBlob: 'encrypted-secret',
    });
    expect(row.identifier).toBe('worker-1');
  });

  it('rejects invalid Telegram tokens before saving credentials', async () => {
    const { connectWorkerChannel } = await import('./worker-channel-connect.js');

    await expect(connectWorkerChannel({
      workspaceId: 'workspace-1',
      workerId: 'worker-1',
      channel: 'telegram',
      credentials: { bot_token: 'bad-token' },
    })).rejects.toMatchObject({
      code: 'INVALID_TELEGRAM_TOKEN',
      statusCode: 400,
    });

    expect(mocks.createWorkerChannel).not.toHaveBeenCalled();
    expect(mocks.registerChannel).not.toHaveBeenCalled();
  });
});
