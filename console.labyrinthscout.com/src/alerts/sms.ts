import type { AlertAdapter, AlertChannel, SecurityEvent } from './types.js';
import { formatAlert } from './templates.js';

/**
 * SMS alert delivery via Twilio.
 * TODO: Consolidate with core.carinaai.uk/src/gateway/channels/adapters/sms-adapter.ts
 * once alerting and gateway share a common transport layer.
 */
export class SmsAdapter implements AlertAdapter {
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
      process.env.SCOUT_TWILIO_PHONE_NUMBER ??
      process.env.TWILIO_PHONE_NUMBER ??
      channel.config.from_number;
    const to = channel.config.to_number;

    if (!accountSid || !authToken || !from || !to) {
      throw new Error('SMS adapter: missing Twilio credentials or to_number');
    }

    const body =
      formatAlert('sms', event.severity, event) ??
      `[LABYRINTH] ${event.severity.toUpperCase()}: ${event.event_type} — ${event.instance_id}`;

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        },
        body: new URLSearchParams({ To: to, From: from, Body: body.slice(0, 1600) }),
        signal: AbortSignal.timeout(10000),
      },
    );

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Twilio API error ${response.status}: ${text}`);
    }
  }
}
