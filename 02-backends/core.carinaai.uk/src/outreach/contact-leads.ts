import { isOutreachPaused } from './control.js';
import { listLeads } from './leads.js';
import { appendTimeline } from './pipeline.js';
import { mutateOutreachStore } from './store.js';
import type { OutreachLead, PipelineStatus } from './types.js';

export interface ContactLeadDraftPlan {
  leadId: string;
  name: string;
  email: string;
  subject: string;
  draftBody: string;
}

export interface ContactLeadsPlanResult {
  ok: boolean;
  error?: string;
  paused?: boolean;
  selected: number;
  skippedMissingEmail: number;
  capped: number;
  drafts: ContactLeadDraftPlan[];
  skippedIds: string[];
}

const DEFAULT_BATCH_CAP = 10;

function defaultSubject(topic: string, lead: OutreachLead): string {
  const company = lead.company?.trim() || lead.name;
  const topicBit = topic.trim() || 'a quick chat';
  return `Quick idea for ${company}: ${topicBit}`;
}

function defaultBody(topic: string, lead: OutreachLead): string {
  const topicBit = topic.trim() || 'a short discovery call';
  return [
    `Hi ${lead.name || 'there'},`,
    '',
    `I wanted to reach out about ${topicBit}.`,
    lead.company ? `I think this could help ${lead.company}.` : 'I think this could help your team.',
    '',
    'Open to a brief chat?',
    '',
    'Best',
  ].join('\n');
}

export function planContactLeads(input: {
  workspaceId: string;
  leadIds?: string[];
  status?: PipelineStatus;
  source?: string;
  campaignId?: string;
  topic?: string;
  subjectTemplate?: string;
  bodyTemplate?: string;
  limit?: number;
  /** When true (default), write Soft Wall propose timeline entries. */
  recordTimeline?: boolean;
}): ContactLeadsPlanResult {
  if (isOutreachPaused(input.workspaceId)) {
    return {
      ok: false,
      error: 'Outreach is paused for this workspace. Resume before contacting leads.',
      paused: true,
      selected: 0,
      skippedMissingEmail: 0,
      capped: 0,
      drafts: [],
      skippedIds: [],
    };
  }

  const cap = Math.min(50, Math.max(1, input.limit ?? DEFAULT_BATCH_CAP));
  let leads = listLeads(input.workspaceId, {
    status: input.status,
    source: input.source as OutreachLead['source'] | undefined,
    campaignId: input.campaignId,
  });

  if (Array.isArray(input.leadIds) && input.leadIds.length > 0) {
    const wanted = new Set(input.leadIds.map(String));
    leads = leads.filter((lead) => wanted.has(lead.id));
  }

  const skippedIds: string[] = [];
  const withEmail: OutreachLead[] = [];
  for (const lead of leads) {
    if (!lead.email?.trim()) {
      skippedIds.push(lead.id);
      continue;
    }
    withEmail.push(lead);
  }

  const capped = withEmail.slice(0, cap);
  const topic = input.topic ?? 'a discovery call';
  const drafts: ContactLeadDraftPlan[] = capped.map((lead) => {
    const subject = (input.subjectTemplate || defaultSubject(topic, lead))
      .replaceAll('{{name}}', lead.name || 'there')
      .replaceAll('{{company}}', lead.company || 'your team')
      .replaceAll('{{email}}', lead.email || '');
    const draftBody = (input.bodyTemplate || defaultBody(topic, lead))
      .replaceAll('{{name}}', lead.name || 'there')
      .replaceAll('{{company}}', lead.company || 'your team')
      .replaceAll('{{email}}', lead.email || '')
      .replaceAll('{{topic}}', topic);
    return {
      leadId: lead.id,
      name: lead.name,
      email: lead.email!.trim(),
      subject,
      draftBody,
    };
  });

  if (input.recordTimeline !== false && drafts.length > 0) {
    const byId = new Map(drafts.map((d) => [d.leadId, d]));
    mutateOutreachStore((store) => {
      for (const [leadId, draft] of byId) {
        const idx = store.leads.findIndex((l) => l.workspaceId === input.workspaceId && l.id === leadId);
        if (idx < 0) continue;
        store.leads[idx] = appendTimeline(store.leads[idx]!, {
          kind: 'system',
          message: `Soft Wall draft proposed to ${draft.email} (pending Approvals)`,
          meta: { subject: draft.subject.slice(0, 120) },
        });
      }
    });
  }

  return {
    ok: true,
    selected: drafts.length,
    skippedMissingEmail: skippedIds.length,
    capped: Math.max(0, withEmail.length - drafts.length),
    drafts,
    skippedIds,
  };
}
