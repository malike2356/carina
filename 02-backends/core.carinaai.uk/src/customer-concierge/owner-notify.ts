/**
 * Owner notifications for Customer Concierge support / handoff (Prompt 702).
 */
import React from 'react';
import { sendEmail } from '../email/email-service.js';
import {
  ConciergeOwnerNotifyEmail,
  conciergeOwnerNotifySubject,
  type ConciergeOwnerNotifyKind,
} from '../email/templates/concierge-owner-notify.js';

export async function notifyConciergeOwner(input: {
  to: string;
  workspaceId: string;
  workerId: string;
  businessName?: string | null;
  ownerName?: string | null;
  kind: ConciergeOwnerNotifyKind;
  subject: string;
  summary: string;
  portalPath?: string;
}): Promise<{ sent: boolean; id?: string }> {
  const to = input.to.trim();
  if (!to.includes('@')) {
    return { sent: false };
  }

  const firstName =
    (input.ownerName?.trim().split(/\s+/)[0])
    || to.split('@')[0]
    || 'there';
  const businessName = input.businessName?.trim() || 'Your business';
  const portalUrl =
    `https://app.carinaai.uk${input.portalPath
      ?? `/aiva/workers/${encodeURIComponent(input.workerId)}?tab=concierge`}`;

  try {
    const result = await sendEmail({
      to,
      subject: conciergeOwnerNotifySubject(input.kind),
      template: React.createElement(ConciergeOwnerNotifyEmail, {
        firstName,
        businessName,
        kind: input.kind,
        subject: input.subject,
        summary: input.summary,
        portalUrl,
      }),
      transactional: true,
      workspaceId: input.workspaceId,
      tags: [
        { name: 'category', value: 'concierge_owner_notify' },
        { name: 'kind', value: input.kind },
      ],
    });
    return { sent: true, id: result && typeof result === 'object' ? result.id : undefined };
  } catch (err) {
    console.warn(
      '[CONCIERGE] owner notify failed:',
      err instanceof Error ? err.message : String(err),
    );
    return { sent: false };
  }
}
