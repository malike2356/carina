import { config } from '../config/index.js';
import { readAlertChannelEnv } from '../lib/alert-channels.js';

export async function sendComplianceEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const env = readAlertChannelEnv();
  const apiKey = env.email.resendApiKey || config.alerts.email.resendApiKey;
  const fromAddress = env.email.from || config.alerts.email.from || 'hello@carinaai.uk';

  if (!apiKey) {
    throw new Error('Resend API key not configured');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API error ${response.status}: ${body}`);
  }
}
