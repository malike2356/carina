/**
 * Revalidate Soft Wall outreach deliveries before an delayed approval send.
 */

import { getCampaign, getLead } from '../leads.js';
import { isOutreachPaused } from '../control.js';
import { isAddressSuppressed } from '../suppressions.js';
import { findDeliveryByApprovalId } from '../soft-wall-approvals.js';
import { getSequence, listEnrollments } from '../sequence-engine.js';
import { loadOutreachStore } from '../store.js';

export type ApprovalRevalidationResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Called immediately before sending an approved Soft Wall outreach email.
 * Non-outreach approvals (no linked delivery) pass through.
 */
export function revalidateOutreachApprovalBeforeSend(input: {
  workspaceId: string;
  approvalId: string;
}): ApprovalRevalidationResult {
  const delivery = findDeliveryByApprovalId(input.workspaceId, input.approvalId);
  if (!delivery) {
    return { ok: true };
  }

  if (isOutreachPaused(input.workspaceId)) {
    return { ok: false, reason: 'outreach_paused' };
  }

  const lead = getLead(input.workspaceId, delivery.leadId);
  if (!lead) {
    return { ok: false, reason: 'lead_missing' };
  }

  if (lead.replyState === 'unsubscribed') {
    return { ok: false, reason: 'unsubscribed' };
  }
  if (lead.status === 'suppressed' || lead.consentStatus === 'opted_out' || lead.consentStatus === 'suppressed') {
    return { ok: false, reason: 'suppressed' };
  }
  if (isAddressSuppressed(input.workspaceId, lead.email)) {
    return { ok: false, reason: 'suppression_list' };
  }

  const sequence = getSequence(input.workspaceId, delivery.sequenceId);
  if (lead.replyState === 'replied' && sequence?.stopOnReply !== false) {
    return { ok: false, reason: 'already_replied' };
  }
  if (
    (lead.bookingState === 'booked' || lead.bookingState === 'attended')
    && sequence?.stopOnBooking !== false
  ) {
    return { ok: false, reason: 'already_booked' };
  }

  const enrollment = loadOutreachStore().enrollments.find(
    (e) => e.workspaceId === input.workspaceId && e.id === delivery.enrollmentId,
  );
  if (enrollment?.campaignId) {
    const campaign = getCampaign(input.workspaceId, enrollment.campaignId);
    if (campaign && campaign.active === false) {
      return { ok: false, reason: 'campaign_inactive' };
    }
  }

  if (!lead.email?.trim()) {
    return { ok: false, reason: 'missing_email' };
  }

  // Eligibility: still contactable for cold outreach.
  const activeSameSequence = listEnrollments(input.workspaceId, {
    leadId: lead.id,
    status: 'active',
  }).some((e) => e.sequenceId === delivery.sequenceId);
  if (!activeSameSequence && enrollment && enrollment.status === 'stopped') {
    // Enrollment may already have advanced; still allow send if delivery is pending.
    if (delivery.status !== 'pending_approval') {
      return { ok: false, reason: 'delivery_not_pending' };
    }
  }

  if (delivery.status !== 'pending_approval') {
    return { ok: false, reason: `delivery_status_${delivery.status}` };
  }

  return { ok: true };
}
