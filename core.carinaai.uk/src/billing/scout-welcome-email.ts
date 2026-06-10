import { Resend } from 'resend';
import { config } from '../config/index.js';

export async function sendScoutWelcomeEmail(opts: {
  email: string;
  setupToken: string;
  scoutConsoleUrl: string;
}): Promise<void> {
  if (!config.resend.apiKey) {
    console.warn('[carina:scout-welcome] Skipped: RESEND_API_KEY not set');
    return;
  }

  const cloudHost = config.hosted.appHost;
  const cloudOrigin = `https://${cloudHost}`;
  const activateUrl = `${opts.scoutConsoleUrl.replace(/\/+$/, '')}/account/activate?token=${encodeURIComponent(opts.setupToken)}`;
  const securityUrl = `${cloudOrigin}/security?activated=1`;
  const loginUrl = `${cloudOrigin}/hosted-login`;

  const resend = new Resend(config.resend.apiKey);
  await resend.emails.send({
    from: config.resend.from,
    to: opts.email,
    subject: 'Labyrinth Scout is ready',
    text: [
      'Your Labyrinth Scout subscription is active.',
      '',
      'Carina Cloud (no .env required):',
      `1. Sign in: ${loginUrl}`,
      `2. Open Security: ${securityUrl}`,
      'Your cloud workspace is monitored automatically.',
      '',
      'Scout console (pairing keys and trust settings):',
      `Set your Scout password: ${activateUrl}`,
      '',
      'Self-hosted Carina later: copy your pairing key from Carina Cloud Security after sign-in.',
      '',
      'Questions: contact@verlox.uk',
    ].join('\n'),
  });
}
