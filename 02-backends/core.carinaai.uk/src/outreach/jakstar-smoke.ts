import { buildBookingConfirmationEmail, createBooking, listBookings, markBookingAttended, markBookingConfirmationSent } from './bookings.js';
import { emptyOutreachStore, loadOutreachStore, mutateOutreachStore, saveOutreachStore } from './store.js';
import { createCampaign, createLead, importLeadBatch } from './leads.js';
import { createSequence, enrollLead, markDeliveryStatus, processDueSends, recordLeadReply, recordLeadUnsubscribe } from './sequence-engine.js';
import { pauseOutreach, resumeOutreach } from './control.js';
import { processDueReminders } from './reminders.js';

export type JakstarSmokeStep = {
  name: string;
  ok: boolean;
  detail?: string;
};

export type JakstarSmokeReport = {
  workspaceId: string;
  generatedAt: string;
  steps: JakstarSmokeStep[];
};

export function runJakstarOutreachSmoke(workspaceId: string, now = new Date()): JakstarSmokeReport {
  saveOutreachStore({
    ...emptyOutreachStore(),
  });

  const steps: JakstarSmokeStep[] = [];
  const campaign = createCampaign({
    workspaceId,
    name: 'Jakstar smoke campaign',
    dailyCap: 2,
    weeklyTarget: 4,
    requireApproval: true,
    fromEmail: 'smoke@example.com',
  });
  const sequence = createSequence({
    workspaceId,
    name: 'Smoke sequence',
    steps: [{ id: 'step-1', order: 1, label: 'First touch', channel: 'email', subject: 'Hello {{name}}', body: 'Body', delayHours: 0 }],
  });
  const lead = createLead({
    workspaceId,
    name: 'Smoke Lead',
    email: 'smoke@example.com',
    company: 'Smoke Ltd',
    companyNumber: '00000006',
    source: 'companies_house',
    campaignId: campaign.id,
  }).lead;

  steps.push({
    name: 'lead-created',
    ok: Boolean(lead.id),
    detail: lead.companyNumber ?? '',
  });

  const duplicate = importLeadBatch(workspaceId, [
    {
      name: 'Duplicate Lead',
      email: 'duplicate@example.com',
      company: 'Smoke Ltd',
      companyNumber: '00000006',
      source: 'companies_house',
      campaignId: campaign.id,
    },
  ]);
  steps.push({
    name: 'company-number-dedupe',
    ok: duplicate.duplicates.length === 1,
  });

  enrollLead({
    workspaceId,
    leadId: lead.id,
    sequenceId: sequence.id,
    campaignId: campaign.id,
    startAt: now,
  });

  const processed = processDueSends(workspaceId, now);
  steps.push({
    name: 'send-queued',
    ok: processed.processed.length === 1,
  });

  if (processed.processed[0]) {
    markDeliveryStatus(workspaceId, processed.processed[0].id, 'sent');
  }

  recordLeadReply(workspaceId, lead.id);
  steps.push({
    name: 'reply-recorded',
    ok: loadOutreachStore().leads.find((row) => row.id === lead.id)?.replyState === 'replied',
  });

  const booking = createBooking({
    workspaceId,
    leadId: lead.id,
    startsAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    endsAt: new Date(now.getTime() + 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
    joinLink: 'https://meet.example.com/smoke',
    notes: 'Smoke booking',
  });
  const email = buildBookingConfirmationEmail({
    leadName: lead.name,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    timezone: booking.timezone,
    joinLink: booking.joinLink,
  });
  steps.push({
    name: 'booking-created',
    ok: Boolean(booking.id) && email.body.includes('https://meet.example.com/smoke'),
  });

  markBookingConfirmationSent(workspaceId, booking.id);
  const reminders = processDueReminders(workspaceId);
  steps.push({
    name: 'reminders-available',
    ok: Array.isArray(reminders.sent) && Array.isArray(reminders.skipped) && Array.isArray(reminders.operatorAlerts),
  });

  markBookingAttended(workspaceId, booking.id);
  steps.push({
    name: 'booking-attended',
    ok: listBookings(workspaceId, { status: 'attended' }).length === 1,
  });

  pauseOutreach(workspaceId, 'smoke pause', 'smoke');
  const paused = processDueSends(workspaceId, now);
  steps.push({
    name: 'pause-blocks-sends',
    ok: paused.processed.length === 0,
  });
  resumeOutreach(workspaceId, 'smoke');

  recordLeadUnsubscribe(workspaceId, lead.id);
  mutateOutreachStore((store) => {
    const row = store.leads.find((item) => item.id === lead.id);
    if (row) row.status = 'lost';
  });
  steps.push({
    name: 'unsubscribe-stops',
    ok: loadOutreachStore().leads.find((row) => row.id === lead.id)?.replyState === 'unsubscribed',
  });

  return {
    workspaceId,
    generatedAt: now.toISOString(),
    steps,
  };
}
