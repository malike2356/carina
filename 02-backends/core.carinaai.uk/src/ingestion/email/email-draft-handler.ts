import { getWorker } from '../../workers/worker-store.js';
import { processAivaMessage } from '../../workers/aiva-process-message.js';
import { createEmailApproval } from './worker-approval-store.js';
import { reportAivaScoutEvent } from '../../security/scout-event-queue.js';
import { sendEmail } from '../../email/email-service.js';
import { Text } from '@react-email/components';
import React from 'react';
import type { EmailCategory } from './email-categorizer.js';
import {
  getApproval,
  markApprovalSent,
  resolveApproval,
  type WorkerEmailApproval,
} from './worker-approval-store.js';
import { getEmailCredentials } from './email-connection-store.js';
import { logActivity } from '../../workers/worker-store.js';

function replySubject(originalSubject: string): string {
  const trimmed = originalSubject.trim();
  if (/^re:/i.test(trimmed)) return trimmed;
  return `Re: ${trimmed}`;
}

function fallbackDraft(input: {
  persona: string;
  from: string;
  subject: string;
  body: string;
}): string {
  return [
    'Thank you for your email.',
    '',
    `I have received your message regarding "${input.subject}".`,
    'A member of our team will follow up shortly if anything else is needed.',
    '',
    'Kind regards',
  ].join('\n');
}

export async function draftEmailResponse(input: {
  workerId: string;
  workspaceId: string;
  from: string;
  subject: string;
  body: string;
  category: EmailCategory;
}): Promise<string> {
  const worker = await getWorker(input.workspaceId, input.workerId);
  if (!worker) throw new Error('Worker not found');

  const prompt = [
    `You are ${worker.name}, ${worker.roleDescription}.`,
    worker.personaPrompt,
    '',
    'Draft a professional email reply to the message below. Output only the email body, no subject line.',
    `From: ${input.from}`,
    `Subject: ${input.subject}`,
    '',
    input.body.slice(0, 4000),
  ].join('\n');

  try {
    const draft = await processAivaMessage({
      workerId: input.workerId,
      workspaceId: input.workspaceId,
      userMessage: prompt,
      channel: 'email',
      contactId: input.from,
      contactName: input.from,
    });
    const trimmed = draft.trim();
    if (trimmed.length > 20) return trimmed;
  } catch {
    /* fall through */
  }

  return fallbackDraft({
    persona: worker.personaPrompt,
    from: input.from,
    subject: input.subject,
    body: input.body,
  });
}

export async function createDraftApprovalForEmail(input: {
  workerId: string;
  workspaceId: string;
  digestId?: string;
  messageId?: string;
  from: string;
  subject: string;
  body: string;
  category: EmailCategory;
}): Promise<WorkerEmailApproval | null> {
  if (input.category !== 'client_query' && input.category !== 'urgent') {
    return null;
  }

  const worker = await getWorker(input.workspaceId, input.workerId);
  if (!worker || worker.status !== 'active') return null;

  const draftBody = await draftEmailResponse({
    workerId: input.workerId,
    workspaceId: input.workspaceId,
    from: input.from,
    subject: input.subject,
    body: input.body,
    category: input.category,
  });

  const approval = await createEmailApproval({
    workerId: input.workerId,
    workspaceId: input.workspaceId,
    digestId: input.digestId,
    messageId: input.messageId,
    category: input.category,
    recipient: input.from,
    subject: replySubject(input.subject),
    draftBody,
    originalFrom: input.from,
  });

  const { getSocialSettings, emailMatchesAutoSendAllowlist } = await import('../social/social-settings-store.js');
  const settings = await getSocialSettings(input.workspaceId);
  const allowlisted = emailMatchesAutoSendAllowlist(input.from, settings.socialAutoReplyAllowlist);
  const shouldAutoSend = !settings.socialRequireApproval || allowlisted;
  if (shouldAutoSend) {
    try {
      const sent = await sendApprovedEmail({
        workspaceId: input.workspaceId,
        approvalId: approval.id,
        reviewedBy: allowlisted && settings.socialRequireApproval
          ? 'system:email-allowlist'
          : 'system:auto-send',
      });
      return sent ?? approval;
    } catch (err) {
      console.warn(
        '[email-draft] auto-send failed; leaving draft in Approvals:',
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  await reportAivaScoutEvent({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    eventType: 'email_approval_requested',
    description: `Approval requested: reply to ${input.from}`,
    metadata: { approvalId: approval.id, category: input.category },
  });

  void logActivity(input.workerId, {
    actionType: 'escalated',
    summary: `Email draft awaiting approval: ${input.subject}`,
    inputText: draftBody,
    escalated: true,
    channel: 'email',
  }).catch(() => undefined);

  return approval;
}

export async function sendApprovedEmail(input: {
  workspaceId: string;
  approvalId: string;
  reviewedBy: string;
  modifiedBody?: string;
}): Promise<WorkerEmailApproval | null> {
  const existing = await getApproval(input.workspaceId, input.approvalId);
  if (!existing || existing.status !== 'pending') return null;

  try {
    const { revalidateOutreachApprovalBeforeSend } = await import(
      '../../outreach/scheduler/approval-revalidate.js'
    );
    const check = revalidateOutreachApprovalBeforeSend({
      workspaceId: input.workspaceId,
      approvalId: input.approvalId,
    });
    if (!check.ok) {
      try {
        const { markOutreachDeliveryFromApproval } = await import('../../outreach/soft-wall-approvals.js');
        markOutreachDeliveryFromApproval({
          workspaceId: input.workspaceId,
          approvalId: input.approvalId,
          status: 'skipped',
          lastError: `revalidation_${check.reason}`,
        });
      } catch {
        // best-effort
      }
      throw new Error(`Outreach approval revalidation failed: ${check.reason}`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Outreach approval revalidation failed:')) {
      throw err;
    }
    // Revalidation module missing: continue for non-outreach approvals.
  }

  // Send while still pending so a send failure does not leave a false "approved" row.
  const body = input.modifiedBody ?? existing.draftBody;

  let sentVia: 'gmail' | 'resend' = 'resend';
  const { workerHasToolGrant } = await import('../../workers/aiva-parity-store.js');
  const hasGmail = await workerHasToolGrant(
    input.workspaceId,
    existing.workerId,
    'gmail',
  );

  if (hasGmail) {
    const { invokeProductTool } = await import('../../workers/product-tools/invoke.js');
    const gmailResult = await invokeProductTool({
      workspaceId: input.workspaceId,
      workerId: existing.workerId,
      slug: 'gmail',
      action: 'send',
      input: {
        to: existing.recipient,
        subject: existing.subject,
        body,
      },
    });
    if (!gmailResult.ok) {
      throw new Error(gmailResult.error || 'Gmail send failed');
    }
    sentVia = 'gmail';
  } else {
    const creds = await getEmailCredentials(existing.workerId);
    const replyTo = creds?.username;
    await sendEmail({
      to: existing.recipient,
      subject: existing.subject,
      replyTo,
      transactional: true,
      workspaceId: input.workspaceId,
      template: React.createElement(Text, null, body),
    });
    sentVia = 'resend';
  }

  const decision = input.modifiedBody ? 'modified' : 'approved';
  const resolved = await resolveApproval({
    workspaceId: input.workspaceId,
    approvalId: input.approvalId,
    decision,
    reviewedBy: input.reviewedBy,
    modifiedBody: input.modifiedBody,
  });
  if (!resolved) return null;

  await markApprovalSent(resolved.id);

  try {
    const { markOutreachDeliveryFromApproval } = await import('../../outreach/soft-wall-approvals.js');
    markOutreachDeliveryFromApproval({
      workspaceId: input.workspaceId,
      approvalId: resolved.id,
      status: 'sent',
    });
  } catch {
    // Outreach Soft Wall link is best-effort; Approvals send still succeeded.
  }

  await reportAivaScoutEvent({
    workspaceId: input.workspaceId,
    workerId: resolved.workerId,
    eventType: 'email_sent',
    description: `Approved email sent to ${resolved.recipient} via ${sentVia}`,
    metadata: { approvalId: resolved.id, sentVia },
  });

  void logActivity(resolved.workerId, {
    actionType: 'message_sent',
    summary: `Email sent to ${resolved.recipient} via ${sentVia}`,
    outputText: body,
    escalated: false,
    channel: 'email',
  }).catch(() => undefined);

  return { ...resolved, status: 'sent', modifiedBody: input.modifiedBody ?? null };
}

export async function rejectEmailApproval(input: {
  workspaceId: string;
  approvalId: string;
  reviewedBy: string;
}): Promise<WorkerEmailApproval | null> {
  const resolved = await resolveApproval({
    workspaceId: input.workspaceId,
    approvalId: input.approvalId,
    decision: 'rejected',
    reviewedBy: input.reviewedBy,
  });
  if (!resolved) return null;

  try {
    const { markOutreachDeliveryFromApproval } = await import('../../outreach/soft-wall-approvals.js');
    markOutreachDeliveryFromApproval({
      workspaceId: input.workspaceId,
      approvalId: resolved.id,
      status: 'skipped',
      lastError: 'rejected_in_approvals',
    });
  } catch {
    // best-effort Soft Wall sync
  }

  await reportAivaScoutEvent({
    workspaceId: input.workspaceId,
    workerId: resolved.workerId,
    eventType: 'email_approval_rejected',
    description: `Reply to ${resolved.recipient} rejected`,
    metadata: { approvalId: resolved.id },
  });

  return resolved;
}
