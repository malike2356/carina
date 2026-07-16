import { Resend } from 'resend';
import { config } from '../config/index.js';

const FROM = 'Scout Incident Report <contact@verlox.uk>';

export function buildSubscribeConfirmUrl(token: string): string {
  const host = config.hosted.appHost.replace(/^https?:\/\//, '');
  return `https://${host}/api/incident-blog/confirm?token=${encodeURIComponent(token)}`;
}

export function buildSubscribeConfirmEmailText(token: string): string {
  const confirmUrl = buildSubscribeConfirmUrl(token);
  return [
    'Hello,',
    '',
    'You subscribed to the weekly Scout Incident Report at labyrinthscout.com/incidents.',
    '',
    'Every Sunday, you will receive documented AI agent incidents; sourced, verified, and with Scout fixes showing how each could have been prevented.',
    '',
    'Confirm your subscription:',
    confirmUrl,
    '',
    'If you did not subscribe, ignore this email. You will not receive anything.',
    '',
    'Scout Incident Report. A VERLOX product.',
  ].join('\n');
}

export async function sendSubscribeConfirmationEmail(email: string, token: string): Promise<void> {
  if (!config.resend.apiKey) {
    throw new Error('RESEND_API_KEY not set');
  }
  const resend = new Resend(config.resend.apiKey);
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Confirm your subscription -- Scout Incident Report',
    text: buildSubscribeConfirmEmailText(token),
  });
}
