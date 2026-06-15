import { config } from '../config/index.js';

export interface UsageWarningEmailInput {
  orgName: string;
  ownerEmail: string;
  threshold: 80 | 90 | 95 | 100;
  used: number;
  limit: number;
  unit?: 'credits' | 'tokens';
}

export function renderUsageWarningEmailText(input: UsageWarningEmailInput): string {
  const unitLabel = input.unit === 'tokens' ? 'tokens' : 'credits';
  const percentUsed = input.limit > 0 ? Math.round((input.used / input.limit) * 100) : 0;
  return [
    `Your Carina Ops workspace "${input.orgName}" has reached ${input.threshold}% of its monthly ${unitLabel} allowance.`,
    '',
    `Usage this month: ${input.used.toLocaleString()} / ${input.limit.toLocaleString()} ${unitLabel} (${percentUsed}%).`,
    '',
    'Review usage, top up credits, or upgrade your plan on the billing page:',
    'https://core.carinaai.uk/ops/billing',
  ].join('\n');
}

export async function sendUsageWarningEmail(input: UsageWarningEmailInput): Promise<boolean> {
  if (!config.resend.apiKey) {
    console.warn('[carina-ops] RESEND_API_KEY not set; usage warning email skipped');
    return false;
  }
  const unitLabel = input.unit === 'tokens' ? 'token' : 'credit';
  const { Resend } = await import('resend');
  const resend = new Resend(config.resend.apiKey);
  await resend.emails.send({
    from: config.resend.from,
    to: input.ownerEmail,
    subject: `Carina Ops: ${input.orgName} has reached ${input.threshold}% of its monthly ${unitLabel} allowance`,
    text: renderUsageWarningEmailText(input),
  });
  return true;
}
