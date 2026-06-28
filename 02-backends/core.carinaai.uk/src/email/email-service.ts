import { render } from '@react-email/render';
import type { ReactElement } from 'react';
import { Resend } from 'resend';
import { config } from '../config/index.js';
import { isMarketingOptedOut } from './workspace-contact.js';

const resendClient = config.resend.apiKey ? new Resend(config.resend.apiKey) : null;

export interface SendEmailOptions {
  to: string;
  subject: string;
  template: ReactElement;
  replyTo?: string;
  headers?: Record<string, string>;
  tags?: Array<{ name: string; value: string }>;
  /** When false, honour workspace marketing opt-out if workspaceId is set. */
  transactional?: boolean;
  workspaceId?: string;
}

function emailFromHeader(): string {
  const name = process.env.EMAIL_FROM_NAME ?? 'Carina by VERLOX';
  const address =
    process.env.EMAIL_FROM ??
    config.resend.from.match(/<([^>]+)>/)?.[1] ??
    `noreply@${process.env.CARINA_DOMAIN ?? 'carinaai.uk'}`;
  return `${name} <${address}>`;
}

function previewModeEnabled(): boolean {
  if (process.env.RESEND_PREVIEW_MODE === 'true') return true;
  if (process.env.RESEND_PREVIEW_MODE === 'false') return false;
  return process.env.NODE_ENV === 'development';
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  try {
    if (!opts.transactional && opts.workspaceId) {
      const optedOut = await isMarketingOptedOut(opts.workspaceId);
      if (optedOut) {
        console.log(`[EMAIL] Skipped (opt-out): ${opts.to} | ${opts.subject}`);
        return;
      }
    }

    if (previewModeEnabled()) {
      const text = await render(opts.template, { plainText: true });
      console.log(`[EMAIL DEV] To: ${opts.to} | Subject: ${opts.subject}\n${text}`);
      return;
    }

    if (!resendClient || !config.resend.apiKey) {
      console.warn('[EMAIL] RESEND_API_KEY not set; skipping send to', opts.to);
      return;
    }

    await resendClient.emails.send({
      from: emailFromHeader(),
      to: opts.to,
      subject: opts.subject,
      react: opts.template,
      replyTo: opts.replyTo,
      headers: opts.headers,
      tags: opts.tags,
    });
  } catch (err) {
    console.error('[EMAIL] Send failed:', opts.to, opts.subject, err);
  }
}
