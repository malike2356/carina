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

  await reportAivaScoutEvent({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    eventType: 'email_approval_requested',
    description: `Approval requested: reply to ${input.from}`,
    metadata: { approvalId: approval.id, category: input.category },
  });

  void logActivity(input.workerId, {
    actionType: 'escalation',
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

  const decision = input.modifiedBody ? 'modified' : 'approved';
  const resolved = await resolveApproval({
    workspaceId: input.workspaceId,
    approvalId: input.approvalId,
    decision,
    reviewedBy: input.reviewedBy,
    modifiedBody: input.modifiedBody,
  });
  if (!resolved) return null;

  const body = input.modifiedBody ?? resolved.draftBody;
  const creds = await getEmailCredentials(resolved.workerId);
  const replyTo = creds?.username;

  await sendEmail({
    to: resolved.recipient,
    subject: resolved.subject,
    replyTo,
    transactional: true,
    workspaceId: input.workspaceId,
    template: React.createElement(Text, null, body),
  });

  await markApprovalSent(resolved.id);

  await reportAivaScoutEvent({
    workspaceId: input.workspaceId,
    workerId: resolved.workerId,
    eventType: 'email_sent',
    description: `Approved email sent to ${resolved.recipient}`,
    metadata: { approvalId: resolved.id },
  });

  void logActivity(resolved.workerId, {
    actionType: 'message_sent',
    summary: `Email sent to ${resolved.recipient}`,
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

  await reportAivaScoutEvent({
    workspaceId: input.workspaceId,
    workerId: resolved.workerId,
    eventType: 'email_approval_rejected',
    description: `Reply to ${resolved.recipient} rejected`,
    metadata: { approvalId: resolved.id },
  });

  return resolved;
}
