/** Campaign enrolment eligibility and recipient preview. */

import { normalizeEmail } from './dedupe.js';
import { getLead, listLeadLists, listLeads } from './leads.js';
import { getSequence } from './sequence-engine.js';
import { isAddressSuppressed } from './suppressions.js';
import { isOutreachPaused } from './control.js';
import type { OutreachLead, OutreachSequence } from './types.js';

export type EligibilityReason =
  | 'ok'
  | 'missing_email'
  | 'suppressed'
  | 'opted_out'
  | 'unsubscribed'
  | 'already_replied'
  | 'pipeline_suppressed'
  | 'workspace_paused'
  | 'duplicate_email'
  | 'lead_not_found'
  | 'sequence_empty';

export interface EligibilityResult {
  eligible: boolean;
  reason: EligibilityReason;
  detail?: string;
  lead?: OutreachLead;
}

function renderTemplate(template: string, lead: OutreachLead, cta?: string): string {
  return template
    .replace(/\{\{\s*name\s*\}\}/gi, lead.contactName || lead.name || '')
    .replace(/\{\{\s*company\s*\}\}/gi, lead.company || '')
    .replace(/\{\{\s*email\s*\}\}/gi, lead.email || '')
    .replace(/\{\{\s*cta\s*\}\}/gi, cta || '');
}

export function assessLeadEnrolmentEligibility(
  workspaceId: string,
  leadOrId: string | OutreachLead,
  opts?: { requireEmail?: boolean; allowReplied?: boolean },
): EligibilityResult {
  if (isOutreachPaused(workspaceId)) {
    return { eligible: false, reason: 'workspace_paused' };
  }
  const lead = typeof leadOrId === 'string' ? getLead(workspaceId, leadOrId) : leadOrId;
  if (!lead || lead.workspaceId !== workspaceId) {
    return { eligible: false, reason: 'lead_not_found' };
  }
  if (opts?.requireEmail !== false && !normalizeEmail(lead.email)) {
    return { eligible: false, reason: 'missing_email', lead };
  }
  if (lead.status === 'suppressed' || lead.consentStatus === 'suppressed') {
    return { eligible: false, reason: 'pipeline_suppressed', lead };
  }
  if (lead.consentStatus === 'opted_out') {
    return { eligible: false, reason: 'opted_out', lead };
  }
  if (lead.replyState === 'unsubscribed') {
    return { eligible: false, reason: 'unsubscribed', lead };
  }
  if (isAddressSuppressed(workspaceId, lead.email)) {
    return { eligible: false, reason: 'suppressed', lead, detail: 'address on suppression list' };
  }
  if (!opts?.allowReplied && lead.replyState === 'replied') {
    return { eligible: false, reason: 'already_replied', lead };
  }
  return { eligible: true, reason: 'ok', lead };
}

export function previewCampaignRecipients(input: {
  workspaceId: string;
  leadIds?: string[];
  listId?: string;
  sequenceId?: string;
  campaignId?: string;
  sampleLimit?: number;
}): {
  totalSelected: number;
  eligible: number;
  ineligible: Array<{ leadId: string; reason: EligibilityReason; detail?: string }>;
  previews: Array<{
    leadId: string;
    email?: string;
    company?: string;
    contactName?: string;
    subject: string;
    body: string;
    stepOrder: number;
  }>;
  sequence?: OutreachSequence | null;
} {
  const storeLeads = listLeads(input.workspaceId);
  let selected = storeLeads;
  if (input.leadIds?.length) {
    const set = new Set(input.leadIds);
    selected = storeLeads.filter((l) => set.has(l.id));
  }
  if (input.listId) {
    const list = listLeadLists(input.workspaceId).find((row) => row.id === input.listId);
    if (list) {
      const set = new Set(list.leadIds);
      selected = selected.filter((l) => set.has(l.id));
    }
  }

  const seenEmails = new Set<string>();
  const ineligible: Array<{ leadId: string; reason: EligibilityReason; detail?: string }> = [];
  const eligibleLeads: OutreachLead[] = [];

  for (const lead of selected) {
    const check = assessLeadEnrolmentEligibility(input.workspaceId, lead);
    if (!check.eligible) {
      ineligible.push({ leadId: lead.id, reason: check.reason, detail: check.detail });
      continue;
    }
    const email = normalizeEmail(lead.email);
    if (email && seenEmails.has(email)) {
      ineligible.push({ leadId: lead.id, reason: 'duplicate_email' });
      continue;
    }
    if (email) seenEmails.add(email);
    eligibleLeads.push(lead);
  }

  const sequence = input.sequenceId ? getSequence(input.workspaceId, input.sequenceId) : null;
  const firstStep = sequence?.steps?.[0];
  const sampleLimit = Math.max(1, Math.min(input.sampleLimit ?? 5, 25));
  const previews = eligibleLeads.slice(0, sampleLimit).map((lead) => ({
    leadId: lead.id,
    email: lead.email,
    company: lead.company,
    contactName: lead.contactName || lead.name,
    subject: firstStep ? renderTemplate(firstStep.subject, lead, firstStep.cta) : '',
    body: firstStep ? renderTemplate(firstStep.body, lead, firstStep.cta) : '',
    stepOrder: firstStep?.order ?? 0,
  }));

  return {
    totalSelected: selected.length,
    eligible: eligibleLeads.length,
    ineligible,
    previews,
    sequence,
  };
}
