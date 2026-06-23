import { config } from '../config/index.js';
import type { TenantEmailIdentity } from './brand-email.js';

export interface InviteEmailInput {
  to: string;
  orgName: string;
  role: string;
  inviteUrl: string;
  inviterEmail?: string;
  identity?: TenantEmailIdentity;
}

export interface InviteEmailSender {
  send(input: InviteEmailInput): Promise<void>;
}

export function buildInviteUrl(token: string, appHost?: string): string {
  const host = appHost ?? config.hosted.appHost;
  return `https://${host}/hosted-register?invite=${encodeURIComponent(token)}`;
}

function productLabel(input: InviteEmailInput): string {
  return input.identity?.productName ?? 'Carina Ops';
}

export function renderInviteEmailText(input: InviteEmailInput): string {
  const productName = productLabel(input);
  const inviter = input.inviterEmail ? `\nInvited by: ${input.inviterEmail}\n` : '\n';
  const footer = input.identity?.footer ? `\n\n${input.identity.footer}` : '';
  return [
    `You are invited to ${input.orgName} on ${productName}.`,
    inviter,
    `Role: ${input.role}`,
    '',
    'Accept your invite:',
    input.inviteUrl,
    '',
    'This link expires in 7 days.',
    footer,
  ].join('\n');
}

export function renderInviteEmailHtml(input: InviteEmailInput): string {
  const productName = productLabel(input);
  const inviter = input.inviterEmail
    ? `<p>Invited by: ${escapeHtml(input.inviterEmail)}</p>`
    : '';
  const footer = input.identity?.footer
    ? `<p>${escapeHtml(input.identity.footer)}</p>`
    : '';
  return [
    `<p>You are invited to <strong>${escapeHtml(input.orgName)}</strong> on ${escapeHtml(productName)}.</p>`,
    inviter,
    `<p>Role: ${escapeHtml(input.role)}</p>`,
    `<p><a href="${escapeHtml(input.inviteUrl)}">Accept invite</a></p>`,
    '<p>This link expires in 7 days.</p>',
    footer,
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
    const productName = productLabel(input);
    await resend.emails.send({
      from: input.identity?.from ?? config.resend.from,
      to: input.to,
      subject: `You are invited to ${input.orgName} on ${productName}`,
      text: renderInviteEmailText(input),
      html: renderInviteEmailHtml(input),
      reply_to: input.identity?.replyTo ?? undefined,
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
