import { describe, expect, it, vi } from 'vitest';
import { sendDiscordWebhook } from './discord-webhook.js';

describe('sendDiscordWebhook', () => {
  it('throws when webhook URL is missing', async () => {
    await expect(sendDiscordWebhook('', 'hello')).rejects.toThrow('webhook URL is required');
  });

  it('posts JSON content to the webhook', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));

    await sendDiscordWebhook('https://discord.com/api/webhooks/test/123', 'alert body');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({ content: 'alert body' });
  });

  it('throws on non-OK responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Not Found', { status: 404 }));

    await expect(
      sendDiscordWebhook('https://discord.com/api/webhooks/test/123', 'alert'),
    ).rejects.toThrow('Discord webhook error 404');
  });
});
