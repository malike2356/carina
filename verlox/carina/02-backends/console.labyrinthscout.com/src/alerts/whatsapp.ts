import type { AlertAdapter, AlertChannel, SecurityEvent } from './types.js';
import { formatAlert } from './templates.js';

/**
 * WhatsApp alert delivery via Twilio WhatsApp API.
 */
export class WhatsAppAdapter implements AlertAdapter {
  async send(event: SecurityEvent, channel: AlertChannel): Promise<void> {
    const accountSid =
      process.env.SCOUT_TWILIO_ACCOUNT_SID ??
      process.env.TWILIO_ACCOUNT_SID ??
      channel.config.account_sid;
    const authToken =
      process.env.SCOUT_TWILIO_AUTH_TOKEN ??
      process.env.TWILIO_AUTH_TOKEN ??
      channel.config.auth_token;
    const from =
      process.env.SCOUT_TWILIO_WHATSAPP_FROM ??
      process.env.TWILIO_WHATSAPP_FROM ??
      channel.config.from_number;
    const to = channel.config.to_number;

    if (!accountSid || !authToken || !from || !to) {
      throw new Error('WhatsApp adapter: missing Twilio credentials or to_number');
    }

    const body =
      formatAlert('whatsapp', event.severity, event) ??
      `[LABYRINTH] ${event.severity.toUpperCase()}: ${event.event_type}; ${event.instance_id}`;

    const toAddress = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    const fromAddress = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          To: toAddress,
          From: fromAddress,
          Body: body.slice(0, 1600),
        }),
        signal: AbortSignal.timeout(10000),
      },
    );

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Twilio WhatsApp API error ${response.status}: ${text}`);
    }
  }
}
