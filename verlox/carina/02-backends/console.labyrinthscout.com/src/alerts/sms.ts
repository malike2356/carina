import { sendTwilioSms } from '@verlox/carina-transport';
import type { AlertAdapter, AlertChannel, SecurityEvent } from './types.js';
import { formatAlert } from './templates.js';

/**
 * SMS alert delivery via Twilio.
 * Uses @verlox/carina-transport for the HTTP send; Scout owns templates and severity routing.
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
      `[LABYRINTH] ${event.severity.toUpperCase()}: ${event.event_type}; ${event.instance_id}`;

    await sendTwilioSms({
      accountSid,
      authToken,
      from,
      to,
      body,
    });
  }
}
