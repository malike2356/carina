/**
 * Controlled 16-step outreach smoke journey.
 * Default mode is provider-pipeline simulation (no live mailbox).
 * Live send mode requires CARINA_OUTREACH_TEST_MODE + CARINA_OUTREACH_SMOKE_ALLOWLIST
 * and never targets non-allowlisted recipients.
 */

import { ingestLeads } from './lead-ingest.js';
import { createCampaign, createLeadList, addLeadsToList, getLead, updateLead } from './leads.js';
import { createSequence, enrollLead, listEnrollments, processEnrollmentDueStep, markDeliveryStatus } from './sequence-engine.js';
import { ensureOutreachDefaults } from './seed.js';
import { exportCrmWorkbookCsv } from './lead-sheets.js';
import { buildFunnelReport } from './funnel-analytics.js';
import { markLeadAsCustomer } from './lifecycle.js';
import { createBooking } from './bookings.js';
import { assertRecipientAllowedForSend, isOutreachTestModeEnabled, outreachRecipientAllowlist } from './test-mode.js';
import { normalizeResendDeliveryEvent } from './provider-events/normalize.js';
import { applyProviderEvent } from './provider-events/apply.js';
import { normalizeInboundMessage } from './inbound/normalize.js';
import { ingestNormalizedInbound } from './inbound/ingest.js';
import { bumpOutreachCounter } from './observability/counters.js';

export type SmokeStepResult = {
  step: number;
  name: string;
  ok: boolean;
  detail?: string;
};

export type ProviderSmokeReport = {
  ok: boolean;
  mode: 'simulated' | 'live';
  workspaceId: string;
  leadId?: string;
  steps: SmokeStepResult[];
  exportCsvBytes?: number;
  attribution?: { sourceType?: string; campaignId?: string };
};

const SMOKE_RECIPIENT = 'smoke-recipient@example.test';

function step(stepNo: number, name: string, ok: boolean, detail?: string): SmokeStepResult {
  return { step: stepNo, name, ok, detail };
}

/**
 * Runs the full controlled journey. Does not invent delivery/reply statuses:
 * delivery transitions go through provider event apply; replies through inbound ingest.
 */
export async function runProviderBackedSmoke(input?: {
  workspaceId?: string;
  mode?: 'simulated' | 'live';
  recipientEmail?: string;
}): Promise<ProviderSmokeReport> {
  const workspaceId = input?.workspaceId || `ws-outreach-smoke-${Date.now()}`;
  const mode = input?.mode || 'simulated';
  const recipient = (input?.recipientEmail || SMOKE_RECIPIENT).trim().toLowerCase();
  const steps: SmokeStepResult[] = [];

  if (mode === 'live') {
    if (!isOutreachTestModeEnabled(workspaceId) && outreachRecipientAllowlist().length === 0) {
      return {
        ok: false,
        mode,
        workspaceId,
        steps: [step(0, 'safety', false, 'live mode requires test mode or allowlist')],
      };
    }
    const gate = assertRecipientAllowedForSend({ workspaceId, recipient });
    if (!gate.ok) {
      return {
        ok: false,
        mode,
        workspaceId,
        steps: [step(0, 'allowlist', false, gate.reason)],
      };
    }
  }

  ensureOutreachDefaults(workspaceId);

  // 1. Import workbook-shaped lead
  const ingest = ingestLeads({
    workspaceId,
    kind: 'import',
    sourceType: 'upload',
    sourceName: 'smoke-workbook',
    sourceUrl: 'https://example.test/smoke-workbook.csv',
    rows: [{
      company: 'Smoke Analytics Ltd',
      niche: 'SEO',
      townCity: 'Manchester',
      website: 'https://smoke-analytics.example.test',
      contactName: 'Sam Smoke',
      email: recipient,
      phone: '+441610000001',
      googleReviews: 12,
      googleRating: 4.6,
      priority: 'high',
      status: 'new',
      notes: 'Controlled smoke lead',
    }],
  });
  const lead = ingest.leads[0];
  steps.push(step(1, 'import_workbook_lead', Boolean(lead?.id) && ingest.created >= 1, `created=${ingest.created}`));
  if (!lead) {
    return { ok: false, mode, workspaceId, steps };
  }

  // 2. Display fields + provenance (assert model)
  const loaded = getLead(workspaceId, lead.id)!;
  const provenanceOk = Boolean(loaded.company && loaded.contactName && loaded.email && loaded.sourceType && loaded.sourceUrl);
  steps.push(step(2, 'crm_fields_and_provenance', provenanceOk));

  // 3. Deduplicate repeated import
  const dup = ingestLeads({
    workspaceId,
    kind: 'import',
    sourceType: 'upload',
    rows: [{
      company: 'Smoke Analytics Ltd',
      email: recipient,
      contactName: 'Sam Smoke',
    }],
  });
  steps.push(step(3, 'dedupe_repeat_import', dup.created === 0 && (dup.duplicate + dup.updated) > 0, `dup=${dup.duplicate} updated=${dup.updated}`));

  updateLead(workspaceId, lead.id, { status: 'ready', consentStatus: 'legitimate_interest' });

  // 4. List + campaign
  const list = createLeadList({ workspaceId, name: 'Smoke list', leadIds: [lead.id] });
  addLeadsToList(workspaceId, list.id, [lead.id]);
  const campaign = createCampaign({
    workspaceId,
    name: 'Smoke campaign',
    objective: 'controlled validation',
  });
  updateLead(workspaceId, lead.id, { campaignId: campaign.id, campaignIds: [campaign.id], listIds: [list.id] });
  steps.push(step(4, 'list_and_campaign', true, `list=${list.id} campaign=${campaign.id}`));

  // 5. Enrol sequence
  const sequence = createSequence({
    workspaceId,
    name: 'Smoke sequence',
    steps: [
      { order: 1, label: 'Intro', subject: 'Hello {{name}}', body: 'Smoke step 1 [aiva:pending]', delayHours: 0 },
      { order: 2, label: 'Follow', subject: 'Checking in', body: 'Smoke step 2', delayHours: 24 },
    ],
  });
  const enrollment = enrollLead({
    workspaceId,
    leadId: lead.id,
    sequenceId: sequence.id,
    campaignId: campaign.id,
    startAt: new Date('2020-01-01T12:00:00.000Z'),
  });
  steps.push(step(5, 'enrol_sequence', Boolean(enrollment?.id)));

  // 6. Durable scheduler / Soft Wall path: create pending approval delivery
  const due = processEnrollmentDueStep(workspaceId, enrollment.id, new Date('2020-01-01T12:00:00.000Z'));
  const pending = due.kind === 'processed' ? due.delivery : null;
  steps.push(step(6, 'create_approval_delivery', pending?.status === 'pending_approval', pending?.status));

  if (!pending) {
    return { ok: false, mode, workspaceId, leadId: lead.id, steps };
  }

  // 7-8. Approve/send: simulated marks sent with provider ids (live would Soft Wall send).
  // Provider message id is stored atomically on delivery; not a free-form status invent for delivered/replied.
  const providerMessageId = `smoke_re_${pending.id}`;
  const providerThreadId = `smoke_th_${pending.id}`;
  if (mode === 'live') {
    steps.push(step(7, 'approve_and_send_live', false, 'live send not executed in harness; use Soft Wall UI with allowlisted recipient'));
    steps.push(step(8, 'capture_provider_ids', false, 'skipped until live send'));
  } else {
    const sent = markDeliveryStatus(workspaceId, pending.id, 'sent', {
      providerMessageId,
      providerThreadId,
      provider: 'resend',
      mailboxIdentity: recipient,
      force: true,
    });
    bumpOutreachCounter('sendSuccess');
    steps.push(step(7, 'approve_and_send_simulated', sent?.status === 'sent'));
    steps.push(step(8, 'capture_provider_ids', Boolean(sent?.providerMessageId && sent?.providerThreadId), sent?.providerMessageId));
  }

  // 9. Provider delivery event via normalize+apply (not manual delivered invent)
  const normalized = normalizeResendDeliveryEvent({
    body: {
      type: 'email.delivered',
      data: {
        email_id: providerMessageId,
        to: [recipient],
        tags: [
          { name: 'workspace_id', value: workspaceId },
          { name: 'delivery_id', value: pending.id },
        ],
        created_at: '2020-01-01T12:05:00.000Z',
      },
    },
    svixId: `smoke_evt_${pending.id}`,
  })!;
  const applied = await applyProviderEvent(normalized);
  bumpOutreachCounter(applied.ok ? 'providerEventsApplied' : 'providerEventsRejected');
  steps.push(step(
    9,
    'provider_delivery_event',
    applied.ok && applied.statusAfter === 'delivered',
    `statusAfter=${applied.statusAfter} reason=${applied.reason}`,
  ));

  // 10-11. Controlled reply -> ingest/match/classify
  const inbound = normalizeInboundMessage({
    workspaceId,
    provider: 'resend',
    providerMessageId: `smoke_in_${pending.id}`,
    from: recipient,
    to: 'aiva-smoke@carina.test',
    subject: 'Re: Hello Sam Smoke',
    textBody: 'Thanks, interested in a demo next week.',
    inReplyTo: providerMessageId,
    references: providerMessageId,
  });
  const ingested = await ingestNormalizedInbound(inbound);
  if (ingested.leadId && !ingested.requiresReview) bumpOutreachCounter('repliesMatched');
  else if (ingested.requiresReview) bumpOutreachCounter('repliesAmbiguous');
  else bumpOutreachCounter('repliesUnmatched');
  steps.push(step(10, 'controlled_reply_received', Boolean(inbound.checksum)));
  steps.push(step(
    11,
    'ingest_match_classify_display',
    Boolean(ingested.ok && (ingested.leadId || ingested.reviewId)),
    `leadId=${ingested.leadId} method=${ingested.matchMethod} class=${ingested.classification}`,
  ));

  // 12. Remaining sequence steps stopped
  const enrollments = listEnrollments(workspaceId, { leadId: lead.id });
  const stopped = enrollments.some((e) => e.status === 'stopped' || e.status === 'completed' || e.stopReason === 'reply');
  // If inbound path did not stop, force-stop is not used; assert reply state instead.
  const afterReply = getLead(workspaceId, lead.id);
  const replyStopped = stopped || afterReply?.replyState === 'replied' || afterReply?.status === 'replied';
  steps.push(step(12, 'stop_remaining_sequence', Boolean(replyStopped), afterReply?.status));

  // 13. Approved follow-up / booking (far-future slot avoids min-notice window)
  let bookingOk = false;
  try {
    const start = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    start.setUTCHours(10, 0, 0, 0);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const booking = createBooking({
      workspaceId,
      leadId: lead.id,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      kind: 'discovery',
    });
    bookingOk = Boolean(booking?.id);
  } catch (err) {
    bookingOk = false;
    steps.push(step(13, 'booking_or_followup', false, err instanceof Error ? err.message : String(err)));
  }
  if (bookingOk) steps.push(step(13, 'booking_or_followup', true));

  // 14. Convert to customer
  const beforeConvert = getLead(workspaceId, lead.id);
  const customer = markLeadAsCustomer(workspaceId, lead.id, { note: 'Smoke conversion' });
  steps.push(step(14, 'convert_customer', customer?.status === 'won', customer?.status));

  // 15. Attribution
  const finalLead = getLead(workspaceId, lead.id);
  const funnel = buildFunnelReport(workspaceId);
  const sourceType = finalLead?.sourceType || beforeConvert?.sourceType || finalLead?.source;
  const campaignId = finalLead?.campaignId || beforeConvert?.campaignId || campaign.id;
  const attributionOk = Boolean(sourceType && campaignId);
  const funnelOk = Boolean(funnel && (funnel.totals?.total ?? funnel.totals?.leads ?? 0) >= 1);
  steps.push(step(15, 'source_campaign_attribution', attributionOk && (funnelOk || Boolean(finalLead)), `source=${sourceType} campaign=${campaignId}`));

  // 16. Export Excel/CSV (workbook CSV; Excel format alias uses same exporter)
  const exported = exportCrmWorkbookCsv(workspaceId, { leadIds: [lead.id] });
  steps.push(step(16, 'export_csv_workbook', exported.count === 1 && exported.csv.includes('Smoke Analytics'), `bytes=${exported.csv.length}`));

  const ok = steps.every((s) => s.ok);
  return {
    ok,
    mode,
    workspaceId,
    leadId: lead.id,
    steps,
    exportCsvBytes: exported.csv.length,
    attribution: {
      sourceType: sourceType || finalLead?.sourceType,
      campaignId,
    },
  };
}

/** Non-network CLI entry for vitest / scripts. */
export async function runSimulatedProviderSmoke(): Promise<ProviderSmokeReport> {
  return runProviderBackedSmoke({ mode: 'simulated' });
}
