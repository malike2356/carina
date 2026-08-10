import { render } from '@react-email/render';
import type { ReactElement } from 'react';
import { isMarketingOptedOut } from './workspace-contact.js';
import { getResendClient, resolveResendApiKey } from './resend-client.js';
import {
  assertSendDomainAllowed,
  resolveFromForRole,
} from './deliverability/runtime.js';

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
  /** Override the sender display name for this email only. */
  fromName?: string;
}

function previewModeEnabled(): boolean {
  if (process.env.RESEND_PREVIEW_MODE === 'true') return true;
  if (process.env.RESEND_PREVIEW_MODE === 'false') return false;
  return process.env.NODE_ENV === 'development';
}

export async function sendEmail(opts: SendEmailOptions): Promise<{ id?: string } | void> {
  const role = opts.transactional === true ? 'transactional' : 'marketing';
  const from = resolveFromForRole(role, opts.fromName);
  // Always fail closed on domain separation (including marketing).
  assertSendDomainAllowed(role, from);

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
      return { id: `preview-${Date.now()}` };
    }

    const resendClient = getResendClient();
    if (!resendClient || !resolveResendApiKey()) {
      const reason = 'RESEND_API_KEY not set; cannot send email';
      if (opts.transactional) throw new Error(reason);
      console.warn('[EMAIL] RESEND_API_KEY not set; skipping send to', opts.to);
      return;
    }

    const result = await resendClient.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      react: opts.template,
      replyTo: opts.replyTo,
      headers: opts.headers,
      tags: opts.tags,
    });

    if (result && typeof result === 'object' && 'error' in result && result.error) {
      const message =
        typeof result.error === 'object' && result.error && 'message' in result.error
          ? String((result.error as { message?: string }).message ?? 'Resend rejected the send')
          : 'Resend rejected the send';
      throw new Error(message);
    }

    const id = result && typeof result === 'object' && 'data' in result
      && result.data && typeof result.data === 'object' && 'id' in result.data
      ? String((result.data as { id?: string }).id ?? '')
      : undefined;
    return id ? { id } : {};
  } catch (err) {
    console.error('[EMAIL] Send failed:', opts.to, opts.subject, err);
    if (opts.transactional) throw err;
  }
}
