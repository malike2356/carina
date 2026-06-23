import { config } from '../config/index.js';
import type { TenantEmailIdentity } from './brand-email.js';
import { appendEmailFooter } from './brand-email.js';

export interface UsageWarningEmailInput {
  orgName: string;
  ownerEmail: string;
  threshold: 80 | 90 | 95 | 100;
  used: number;
  limit: number;
  unit?: 'credits' | 'tokens';
  identity?: TenantEmailIdentity;
  billingUrl?: string;
}

export function renderUsageWarningEmailText(input: UsageWarningEmailInput): string {
  const productName = input.identity?.productName ?? 'Carina Ops';
  const unitLabel = input.unit === 'tokens' ? 'tokens' : 'credits';
  const percentUsed = input.limit > 0 ? Math.round((input.used / input.limit) * 100) : 0;
  const billingUrl = input.billingUrl ?? `${config.product.coreUrl}/ops/billing`;
  const body = [
    `Your ${productName} workspace "${input.orgName}" has reached ${input.threshold}% of its monthly ${unitLabel} allowance.`,
    '',
    `Usage this month: ${input.used.toLocaleString()} / ${input.limit.toLocaleString()} ${unitLabel} (${percentUsed}%).`,
    '',
    'Review usage, top up credits, or upgrade your plan on the billing page:',
    billingUrl,
  ].join('\n');
  return appendEmailFooter(body, input.identity?.footer);
}

export async function sendUsageWarningEmail(input: UsageWarningEmailInput): Promise<boolean> {
  if (!config.resend.apiKey) {
    console.warn('[carina-ops] RESEND_API_KEY not set; usage warning email skipped');
    return false;
  }
  const productName = input.identity?.productName ?? 'Carina Ops';
  const unitLabel = input.unit === 'tokens' ? 'token' : 'credit';
  const { Resend } = await import('resend');
  const resend = new Resend(config.resend.apiKey);
  await resend.emails.send({
    from: input.identity?.from ?? config.resend.from,
    to: input.ownerEmail,
    subject: `${productName}: ${input.orgName} has reached ${input.threshold}% of its monthly ${unitLabel} allowance`,
    text: renderUsageWarningEmailText(input),
    reply_to: input.identity?.replyTo ?? undefined,
  });
  return true;
}
