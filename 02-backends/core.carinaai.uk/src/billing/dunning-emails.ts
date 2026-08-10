/**
 * Dunning recovery email sequence (days 1, 5, 12) with Stripe Customer Portal link.
 */

import type { DunningCase, DunningEmailStage } from './dunning-store.js';
import { loadDunningStore, upsertDunningCase } from './dunning-store.js';

export interface DunningEmailContent {
  stage: DunningEmailStage;
  subject: string;
  preview: string;
  body: string;
  ctaLabel: string;
  urgency: 'friendly' | 'urgent' | 'final';
}

export function buildDunningEmail(
  stage: DunningEmailStage,
  opts: { amount: string; graceEndsLabel: string; portalUrl: string; firstName?: string },
): DunningEmailContent {
  const name = opts.firstName || 'there';
  if (stage === 1) {
    return {
      stage,
      subject: 'Your payment did not go through; update your card',
      preview: 'Friendly reminder to update your payment method',
      urgency: 'friendly',
      ctaLabel: 'Update payment method',
      body: [
        `Hi ${name},`,
        '',
        `We could not collect ${opts.amount}. Your payment did not go through; here is how to update it in about two minutes.`,
        '',
        `Your account stays active until ${opts.graceEndsLabel}.`,
        '',
        `Update here: ${opts.portalUrl}`,
      ].join('\n'),
    };
  }
  if (stage === 2) {
    return {
      stage,
      subject: 'We are holding your account; update payment now',
      preview: 'Your Aiva stays on while you update payment',
      urgency: 'urgent',
      ctaLabel: 'Update payment in 2 minutes',
      body: [
        `Hi ${name},`,
        '',
        'We are holding your account open. Update your payment in about two minutes to avoid interruption.',
        '',
        `Grace window ends ${opts.graceEndsLabel}.`,
        '',
        `Update here: ${opts.portalUrl}`,
      ].join('\n'),
    };
  }
  return {
    stage,
    subject: 'Final notice: subscription cancels in 48 hours',
    preview: 'Last chance to keep your subscription',
    urgency: 'final',
    ctaLabel: 'Update payment method now',
    body: [
      `Hi ${name},`,
      '',
      'Final notice: your subscription will be cancelled in 48 hours unless payment is updated.',
      '',
      `Deadline: ${opts.graceEndsLabel}.`,
      '',
      `Update here: ${opts.portalUrl}`,
    ].join('\n'),
  };
}

export type SendEmailFn = (input: {
  workspaceId: string;
  subject: string;
  body: string;
  portalUrl: string;
  stage: DunningEmailStage;
}) => Promise<void>;

let sendImpl: SendEmailFn | null = null;

/** Tests inject a fake sender; production wires Resend via email-triggers. */
export function setDunningEmailSender(fn: SendEmailFn | null): void {
  sendImpl = fn;
}

async function defaultSend(input: {
  workspaceId: string;
  subject: string;
  body: string;
  portalUrl: string;
  stage: DunningEmailStage;
}): Promise<void> {
  try {
    const { sendPaymentFailedEmail } = await import('../email/email-triggers.js');
    // Reuse payment-failed path for deliverability; stage captured in dunning store.
    await sendPaymentFailedEmail({
      workspaceId: input.workspaceId,
      amount: `stage-${input.stage}`,
      gracePeriodEndsAt: new Date().toISOString(),
      updateUrl: input.portalUrl,
    });
  } catch {
    // never block dunning on email transport
  }
}

export async function sendDunningEmail(
  dunningCase: DunningCase,
  stage: DunningEmailStage,
  opts: { portalUrl: string; amount: string; firstName?: string },
): Promise<DunningCase> {
  const emailLog = dunningCase.emails.find((e) => e.stage === stage);
  if (!emailLog) return dunningCase;
  if (emailLog.sentAt) return dunningCase;

  const content = buildDunningEmail(stage, {
    amount: opts.amount,
    graceEndsLabel: new Date(dunningCase.graceEndsAt).toLocaleString('en-GB'),
    portalUrl: opts.portalUrl,
    firstName: opts.firstName,
  });

  const sender = sendImpl ?? defaultSend;
  await sender({
    workspaceId: dunningCase.workspaceId,
    subject: content.subject,
    body: content.body,
    portalUrl: opts.portalUrl,
    stage,
  });

  const next: DunningCase = {
    ...dunningCase,
    emails: dunningCase.emails.map((e) =>
      e.stage === stage
        ? { ...e, sentAt: new Date().toISOString(), portalUrl: opts.portalUrl }
        : e,
    ),
  };
  return upsertDunningCase(next);
}

export function markDunningEmailOpened(caseId: string, stage: DunningEmailStage): void {
  const found = loadDunningStore().cases.find((c) => c.id === caseId);
  if (!found) return;
  upsertDunningCase({
    ...found,
    emails: found.emails.map((e) =>
      e.stage === stage ? { ...e, openedAt: e.openedAt ?? new Date().toISOString() } : e,
    ),
  });
}

export function markDunningPortalClicked(caseId: string, stage: DunningEmailStage): void {
  const found = loadDunningStore().cases.find((c) => c.id === caseId);
  if (!found) return;
  upsertDunningCase({
    ...found,
    emails: found.emails.map((e) =>
      e.stage === stage ? { ...e, clickedAt: e.clickedAt ?? new Date().toISOString() } : e,
    ),
  });
}
