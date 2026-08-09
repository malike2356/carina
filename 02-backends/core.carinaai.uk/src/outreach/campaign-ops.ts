/** Campaign outcome summaries for Soft Wall outreach. */

import { getCampaign, listCampaigns } from './leads.js';
import { listDeliveries, listEnrollments } from './sequence-engine.js';
import { listReplyReviews } from './replies.js';
import { previewCampaignRecipients } from './eligibility.js';

export function summariseCampaignOutcomes(workspaceId: string, campaignId?: string): {
  campaigns: Array<{
    campaignId: string;
    name: string;
    active: boolean;
    enrollments: number;
    activeEnrollments: number;
    deliveries: number;
    pendingApproval: number;
    sent: number;
    bounced: number;
    replied: number;
    unsubscribed: number;
    openReviews: number;
  }>;
} {
  const campaigns = listCampaigns(workspaceId).filter((c) => !campaignId || c.id === campaignId);
  const enrollments = listEnrollments(workspaceId);
  const deliveries = listDeliveries(workspaceId);
  const reviews = listReplyReviews(workspaceId);

  return {
    campaigns: campaigns.map((campaign) => {
      const campEnroll = enrollments.filter((e) => e.campaignId === campaign.id);
      const leadIds = new Set(campEnroll.map((e) => e.leadId));
      const campDeliveries = deliveries.filter((d) => {
        const enrollment = enrollments.find((e) => e.id === d.enrollmentId);
        return enrollment?.campaignId === campaign.id || leadIds.has(d.leadId);
      });
      const campReviews = reviews.filter((r) => r.leadId && leadIds.has(r.leadId));
      return {
        campaignId: campaign.id,
        name: campaign.name,
        active: campaign.active,
        enrollments: campEnroll.length,
        activeEnrollments: campEnroll.filter((e) => e.status === 'active').length,
        deliveries: campDeliveries.length,
        pendingApproval: campDeliveries.filter((d) => d.status === 'pending_approval').length,
        sent: campDeliveries.filter((d) => d.status === 'sent' || d.status === 'delivered').length,
        bounced: campDeliveries.filter((d) => d.status === 'bounced').length,
        replied: campDeliveries.filter((d) => d.status === 'replied').length
          + campReviews.filter((r) => r.classification === 'interested' || r.classification === 'question').length,
        unsubscribed: campDeliveries.filter((d) => d.status === 'unsubscribed').length,
        openReviews: campReviews.filter((r) => r.status === 'open').length,
      };
    }),
  };
}

export function draftCampaignPreview(input: {
  workspaceId: string;
  campaignId?: string;
  sequenceId: string;
  leadIds?: string[];
  listId?: string;
}) {
  const campaign = input.campaignId ? getCampaign(input.workspaceId, input.campaignId) : null;
  const recipients = previewCampaignRecipients({
    workspaceId: input.workspaceId,
    leadIds: input.leadIds,
    listId: input.listId,
    sequenceId: input.sequenceId,
    campaignId: input.campaignId,
  });
  return {
    campaign,
    ...recipients,
    note: 'Outbound sends require Soft Wall approval via outreach-process-due / Approvals. Do not bypass consent or suppression.',
  };
}
