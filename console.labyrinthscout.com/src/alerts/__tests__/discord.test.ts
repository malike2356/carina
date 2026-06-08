import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiscordAdapter } from '../discord.js';

describe('DiscordAdapter', () => {
  const adapter = new DiscordAdapter();

  const baseEvent = {
    id: 'evt-1',
    instance_id: 'inst-1',
    session_id: 'sess-1',
    event_type: 'honeypot_triggered',
    severity: 'breach' as const,
    description: 'Honeypot was accessed',
    created_at: new Date(),
    acknowledged: false,
    acknowledged_by: null,
    acknowledged_at: null,
  };

  const baseChannel = {
    id: 'ch-1',
    channel_type: 'discord' as const,
    severity_threshold: 'critical' as const,
    enabled: true,
    config: { webhook_url: 'https://discord.com/api/webhooks/test/123' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws if webhook URL is missing', async () => {
    await expect(
      adapter.send(baseEvent, { ...baseChannel, config: {} }),
    ).rejects.toThrow('missing SCOUT_DISCORD_WEBHOOK_URL');
  });

  it('sends breach alert with @everyone mention', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 }),
    );

    await adapter.send(baseEvent, baseChannel);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchSpy.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.content).toContain('@everyone');
    expect(body.content).toContain('BREACH DETECTED');
  });

  it('logs and rethrows on webhook error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Not Found', { status: 404 }),
    );

    await expect(adapter.send(baseEvent, baseChannel)).rejects.toThrow('Discord webhook error 404');
  });
});
