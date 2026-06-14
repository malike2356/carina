import { config } from '../config/index.js';

export interface InviteEmailInput {
  to: string;
  orgName: string;
  role: string;
  inviteUrl: string;
  inviterEmail?: string;
}

export interface InviteEmailSender {
  send(input: InviteEmailInput): Promise<void>;
}

export function buildInviteUrl(token: string, appHost?: string): string {
  const host = appHost ?? config.hosted.appHost ?? 'app.carinaai.uk';
  return `https://${host}/hosted-register?invite=${encodeURIComponent(token)}`;
}

export function renderInviteEmailText(input: InviteEmailInput): string {
  const inviter = input.inviterEmail ? `\nInvited by: ${input.inviterEmail}\n` : '\n';
  return [
    `You are invited to ${input.orgName} on Carina Ops.`,
    inviter,
    `Role: ${input.role}`,
    '',
    'Accept your invite:',
    input.inviteUrl,
    '',
    'This link expires in 7 days.',
  ].join('\n');
}

export function renderInviteEmailHtml(input: InviteEmailInput): string {
  const inviter = input.inviterEmail
    ? `<p>Invited by: ${escapeHtml(input.inviterEmail)}</p>`
    : '';
  return [
    `<p>You are invited to <strong>${escapeHtml(input.orgName)}</strong> on Carina Ops.</p>`,
    inviter,
    `<p>Role: ${escapeHtml(input.role)}</p>`,
    `<p><a href="${escapeHtml(input.inviteUrl)}">Accept invite</a></p>`,
    '<p>This link expires in 7 days.</p>',
  ].join('');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class ResendInviteEmailSender implements InviteEmailSender {
  constructor(private readonly resendFactory: () => { emails: { send: (payload: unknown) => Promise<unknown> } }) {}

  async send(input: InviteEmailInput): Promise<void> {
    const resend = this.resendFactory();
    await resend.emails.send({
      from: config.resend.from,
      to: input.to,
      subject: `You are invited to ${input.orgName} on Carina Ops`,
      text: renderInviteEmailText(input),
      html: renderInviteEmailHtml(input),
    });
  }
}

export async function sendInviteEmail(input: InviteEmailInput): Promise<boolean> {
  if (!config.resend.apiKey) {
    console.warn('[carina-ops] RESEND_API_KEY not set; invite email skipped');
    return false;
  }
  const { Resend } = await import('resend');
  const sender = new ResendInviteEmailSender(() => new Resend(config.resend.apiKey) as never);
  await sender.send(input);
  return true;
}
