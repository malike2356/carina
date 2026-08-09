/** Funnel analytics and conversion attribution. */

import { listLeads } from './leads.js';
import { listDeliveries, listEnrollments } from './sequence-engine.js';
import { listReplyReviews } from './replies.js';
import type { PipelineStatus } from './types.js';

const FUNNEL_ORDER: PipelineStatus[] = [
  'new',
  'enriched',
  'ready',
  'contacted',
  'replied',
  'qualified',
  'booked',
  'attended',
  'proposal_sent',
  'won',
  'nurture',
  'lost',
  'suppressed',
];

function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 1000;
}

export function buildFunnelReport(workspaceId: string): {
  stageCounts: Record<string, number>;
  totals: {
    leads: number;
    withEmail: number;
    contacted: number;
    replied: number;
    qualified: number;
    booked: number;
    customers: number;
    suppressed: number;
  };
  conversionRates: {
    sourceToReply: number;
    replyToQualified: number;
    qualifiedToBooked: number;
    bookedToCustomer: number;
  };
  bySource: Array<{
    source: string;
    leads: number;
    replied: number;
    customers: number;
  }>;
  byCampaign: Array<{
    campaignId: string;
    enrollments: number;
    deliveries: number;
    replies: number;
    customers: number;
  }>;
  recentAttributions: Array<{
    leadId: string;
    company?: string;
    source?: string;
    campaignId?: string;
    sequenceId?: string;
    convertedCustomerAt?: string;
  }>;
} {
  const leads = listLeads(workspaceId);
  const stageCounts: Record<string, number> = Object.fromEntries(FUNNEL_ORDER.map((s) => [s, 0]));
  for (const lead of leads) {
    stageCounts[lead.status] = (stageCounts[lead.status] ?? 0) + 1;
  }

  const withEmail = leads.filter((l) => Boolean(l.email)).length;
  const contacted = leads.filter((l) =>
    ['contacted', 'replied', 'qualified', 'booked', 'attended', 'proposal_sent', 'won', 'nurture'].includes(l.status)
    || Boolean(l.lastContactedAt)).length;
  const replied = leads.filter((l) => l.replyState === 'replied' || ['replied', 'qualified', 'booked', 'won'].includes(l.status)).length;
  const qualified = leads.filter((l) => ['qualified', 'booked', 'attended', 'proposal_sent', 'won'].includes(l.status)).length;
  const booked = leads.filter((l) => ['booked', 'attended', 'proposal_sent', 'won'].includes(l.status) || l.bookingState === 'booked').length;
  const customers = leads.filter((l) => l.status === 'won' || Boolean(l.convertedCustomerAt)).length;
  const suppressed = leads.filter((l) => l.status === 'suppressed' || l.replyState === 'unsubscribed').length;

  const sourceMap = new Map<string, { leads: number; replied: number; customers: number }>();
  for (const lead of leads) {
    const source = lead.sourceType || lead.source || 'unknown';
    const row = sourceMap.get(source) ?? { leads: 0, replied: 0, customers: 0 };
    row.leads += 1;
    if (lead.replyState === 'replied' || lead.status === 'replied' || lead.status === 'won') row.replied += 1;
    if (lead.status === 'won' || lead.convertedCustomerAt) row.customers += 1;
    sourceMap.set(source, row);
  }

  const enrollments = listEnrollments(workspaceId);
  const deliveries = listDeliveries(workspaceId);
  const replies = listReplyReviews(workspaceId);
  const campaignIds = Array.from(new Set([
    ...enrollments.map((e) => e.campaignId).filter(Boolean) as string[],
    ...leads.map((l) => l.campaignId).filter(Boolean) as string[],
  ]));

  const byCampaign = campaignIds.map((campaignId) => {
    const campEnroll = enrollments.filter((e) => e.campaignId === campaignId);
    const campLeadIds = new Set(campEnroll.map((e) => e.leadId));
    const campDeliveries = deliveries.filter((d) => campLeadIds.has(d.leadId) || enrollments.find((e) => e.id === d.enrollmentId)?.campaignId === campaignId);
    const campReplies = replies.filter((r) => r.leadId && campLeadIds.has(r.leadId));
    const campCustomers = leads.filter((l) => (l.campaignId === campaignId || campLeadIds.has(l.id)) && (l.status === 'won' || l.convertedCustomerAt));
    return {
      campaignId,
      enrollments: campEnroll.length,
      deliveries: campDeliveries.length,
      replies: campReplies.length,
      customers: campCustomers.length,
    };
  });

  const recentAttributions = leads
    .filter((l) => l.convertedCustomerAt || l.status === 'won')
    .sort((a, b) => (b.convertedCustomerAt || b.updatedAt).localeCompare(a.convertedCustomerAt || a.updatedAt))
    .slice(0, 25)
    .map((l) => ({
      leadId: l.id,
      company: l.company,
      source: l.sourceType || l.source,
      campaignId: l.campaignId,
      sequenceId: l.sequenceId,
      convertedCustomerAt: l.convertedCustomerAt,
    }));

  return {
    stageCounts,
    totals: {
      leads: leads.length,
      withEmail,
      contacted,
      replied,
      qualified,
      booked,
      customers,
      suppressed,
    },
    conversionRates: {
      sourceToReply: rate(replied, leads.length),
      replyToQualified: rate(qualified, replied),
      qualifiedToBooked: rate(booked, qualified),
      bookedToCustomer: rate(customers, booked),
    },
    bySource: Array.from(sourceMap.entries()).map(([source, row]) => ({ source, ...row })),
    byCampaign,
    recentAttributions,
  };
}
