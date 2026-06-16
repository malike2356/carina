export interface DiscordWebhookPayload {
  content?: string;
  embeds?: unknown[];
  username?: string;
  allowed_mentions?: { parse?: string[] };
}

export interface SendDiscordWebhookOptions {
  timeoutMs?: number;
  payload?: Omit<DiscordWebhookPayload, 'content'>;
}

export async function sendDiscordWebhook(
  webhookUrl: string,
  content: string,
  options: SendDiscordWebhookOptions = {},
): Promise<void> {
  if (!webhookUrl.trim()) {
    throw new Error('Discord webhook URL is required');
  }

  const timeoutMs = options.timeoutMs ?? 8000;
  const body: DiscordWebhookPayload = {
    content,
    ...options.payload,
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Discord webhook error ${response.status}: ${text}`);
  }
}
