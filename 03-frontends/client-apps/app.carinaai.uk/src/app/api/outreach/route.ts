import { NextResponse } from 'next/server';
import { asc, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  calendarEvents,
  outreachBookings,
  outreachCampaigns,
  outreachChannelEnum,
  outreachLeadStageEnum,
  outreachLeads,
  outreachMessages,
  outreachReminderStatusEnum,
  outreachReminders,
  outreachSequenceSteps,
  outreachStepKindEnum,
  outreachTimeline,
  outreachTimelineKindEnum,
} from '@/db/schema';
import {
  buildTimelineTitle,
  classifyOutreachReply,
  defaultLeadStageForChannel,
  extractReplySummary,
  leadStageFromReply,
  replyTimelineKind,
} from '@/lib/outreach';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

const CAMPAIGN_STATUSES = ['draft', 'active', 'paused', 'completed'] as const;
const LEAD_STAGES = [...outreachLeadStageEnum.enumValues] as const;
const CHANNELS = [...outreachChannelEnum.enumValues] as const;
const TIMELINE_KINDS = [...outreachTimelineKindEnum.enumValues] as const;
const STEP_KINDS = [...outreachStepKindEnum.enumValues] as const;
const BOOKING_STATUSES = ['tentative', 'confirmed', 'rescheduled', 'cancelled'] as const;
const REMINDER_STATUSES = [...outreachReminderStatusEnum.enumValues] as const;
const MESSAGE_STATUSES = ['draft', 'queued', 'sent', 'delivered', 'failed', 'replied'] as const;

type OutreachMessageStatus = (typeof MESSAGE_STATUSES)[number];

function cleanText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function cleanOptionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text : null;
}

function cleanDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function cleanStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function parseChannel(value: unknown) {
  const candidate = cleanText(value).toLowerCase();
  return CHANNELS.includes(candidate as (typeof CHANNELS)[number])
    ? (candidate as (typeof CHANNELS)[number])
    : 'email';
}

function parseCampaignStatus(value: unknown) {
  const candidate = cleanText(value).toLowerCase();
  return CAMPAIGN_STATUSES.includes(candidate as (typeof CAMPAIGN_STATUSES)[number])
    ? (candidate as (typeof CAMPAIGN_STATUSES)[number])
    : 'draft';
}

function parseLeadStage(value: unknown) {
  const candidate = cleanText(value).toLowerCase();
  return LEAD_STAGES.includes(candidate as (typeof LEAD_STAGES)[number])
    ? (candidate as (typeof LEAD_STAGES)[number])
    : 'prospect';
}

function parseTimelineKind(value: unknown) {
  const candidate = cleanText(value).toLowerCase();
  return TIMELINE_KINDS.includes(candidate as (typeof TIMELINE_KINDS)[number])
    ? (candidate as (typeof TIMELINE_KINDS)[number])
    : 'note_added';
}

function parseStepKind(value: unknown) {
  const candidate = cleanText(value).toLowerCase();
  return STEP_KINDS.includes(candidate as (typeof STEP_KINDS)[number])
    ? (candidate as (typeof STEP_KINDS)[number])
    : 'email';
}

function parseBookingStatus(value: unknown) {
  const candidate = cleanText(value).toLowerCase();
  return BOOKING_STATUSES.includes(candidate as (typeof BOOKING_STATUSES)[number])
    ? (candidate as (typeof BOOKING_STATUSES)[number])
    : 'tentative';
}

function parseReminderStatus(value: unknown) {
  const candidate = cleanText(value).toLowerCase();
  return REMINDER_STATUSES.includes(candidate as (typeof REMINDER_STATUSES)[number])
    ? (candidate as (typeof REMINDER_STATUSES)[number])
    : 'scheduled';
}

function parseTextStatus(value: unknown): OutreachMessageStatus {
  const candidate = cleanText(value).toLowerCase();
  return MESSAGE_STATUSES.includes(candidate as OutreachMessageStatus)
    ? (candidate as OutreachMessageStatus)
    : 'queued';
}

async function createTimelineEntry(
  tx: any,
  entry: {
    workspaceId: string;
    campaignId?: string | null;
    leadId?: string | null;
    kind: (typeof TIMELINE_KINDS)[number];
    title: string;
    detail?: string;
    direction?: 'outbound' | 'inbound';
    metadata?: Record<string, unknown>;
  },
) {
  const [created] = await tx
    .insert(outreachTimeline)
    .values({
      workspaceId: entry.workspaceId,
      campaignId: entry.campaignId ?? null,
      leadId: entry.leadId ?? null,
      kind: entry.kind,
      title: entry.title,
      detail: entry.detail ?? '',
      direction: entry.direction ?? 'outbound',
      metadata: entry.metadata ?? {},
    })
    .returning();
  return created;
}

function nextFollowUpFromReply(replyClass: ReturnType<typeof classifyOutreachReply>) {
  const now = new Date();
  if (replyClass === 'question' || replyClass === 'interest') {
    now.setDate(now.getDate() + 2);
    return now;
  }
  if (replyClass === 'booking') {
    now.setHours(now.getHours() + 24);
    return now;
  }
  return null;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);

  const [
    campaigns,
    leads,
    steps,
    timeline,
    messages,
    bookings,
    reminders,
  ] = await Promise.all([
    db
      .select()
      .from(outreachCampaigns)
      .where(eq(outreachCampaigns.workspaceId, workspace.id))
      .orderBy(desc(outreachCampaigns.updatedAt)),
    db
      .select()
      .from(outreachLeads)
      .where(eq(outreachLeads.workspaceId, workspace.id))
      .orderBy(desc(outreachLeads.updatedAt)),
    db
      .select()
      .from(outreachSequenceSteps)
      .where(eq(outreachSequenceSteps.workspaceId, workspace.id))
      .orderBy(asc(outreachSequenceSteps.position), desc(outreachSequenceSteps.updatedAt)),
    db
      .select()
      .from(outreachTimeline)
      .where(eq(outreachTimeline.workspaceId, workspace.id))
      .orderBy(desc(outreachTimeline.createdAt))
      .limit(100),
    db
      .select()
      .from(outreachMessages)
      .where(eq(outreachMessages.workspaceId, workspace.id))
      .orderBy(desc(outreachMessages.createdAt))
      .limit(100),
    db
      .select()
      .from(outreachBookings)
      .where(eq(outreachBookings.workspaceId, workspace.id))
      .orderBy(desc(outreachBookings.createdAt))
      .limit(100),
    db
      .select()
      .from(outreachReminders)
      .where(eq(outreachReminders.workspaceId, workspace.id))
      .orderBy(desc(outreachReminders.createdAt))
      .limit(100),
  ]);

  const summary = {
    campaignCount: campaigns.length,
    activeCampaigns: campaigns.filter((campaign) => campaign.status === 'active').length,
    leadCount: leads.length,
    repliedLeads: leads.filter((lead) => lead.stage === 'replied').length,
    bookedLeads: leads.filter((lead) => lead.stage === 'booked').length,
    dueFollowUps: leads.filter((lead) => lead.nextFollowUpAt && new Date(lead.nextFollowUpAt) <= new Date()).length,
  };

  return NextResponse.json({
    data: {
      campaigns,
      leads,
      steps,
      timeline,
      messages,
      bookings,
      reminders,
      summary,
    },
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = cleanText(body.action).toLowerCase();

  if (!action) {
    return NextResponse.json({ error: 'action is required' }, { status: 400 });
  }

  if (action === 'createcampaign') {
    const name = cleanText(body.name);
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const created = await db.transaction(async (tx) => {
      const rows = await tx
        .insert(outreachCampaigns)
        .values({
          workspaceId: workspace.id,
          name,
          description: cleanText(body.description),
          status: parseCampaignStatus(body.status),
          channel: parseChannel(body.channel),
          audience: cleanText(body.audience),
          dailyTarget: typeof body.dailyTarget === 'number' ? Math.max(0, Math.floor(body.dailyTarget)) : 0,
          stopOnReply: body.stopOnReply !== false,
          stopOnBooking: body.stopOnBooking !== false,
          stopOnUnsubscribe: body.stopOnUnsubscribe !== false,
          launchAt: cleanDate(body.launchAt),
          completedAt: cleanDate(body.completedAt),
        })
        .returning();
      const createdRow = rows[0];
      if (createdRow) {
        await createTimelineEntry(tx, {
          workspaceId: workspace.id,
          campaignId: createdRow.id,
          kind: 'campaign_created',
          title: buildTimelineTitle('campaign_created', createdRow.name),
          detail: createdRow.description || 'Campaign created.',
        });
      }
      return rows[0] ?? null;
    });

    return NextResponse.json({ data: created });
  }

  if (action === 'updatecampaign') {
    const campaignId = cleanText(body.campaignId);
    if (!campaignId) return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
    const [existing] = await db
      .select()
      .from(outreachCampaigns)
      .where(eq(outreachCampaigns.id, campaignId))
      .limit(1);
    if (!existing || existing.workspaceId !== workspace.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const updated = await db.transaction(async (tx) => {
      const rows = await tx
        .update(outreachCampaigns)
        .set({
          name: cleanText(body.name, existing.name),
          description: body.description === undefined ? existing.description : cleanText(body.description),
          status: body.status === undefined ? existing.status : parseCampaignStatus(body.status),
          channel: body.channel === undefined ? existing.channel : parseChannel(body.channel),
          audience: body.audience === undefined ? existing.audience : cleanText(body.audience),
          dailyTarget:
            typeof body.dailyTarget === 'number'
              ? Math.max(0, Math.floor(body.dailyTarget))
              : existing.dailyTarget,
          stopOnReply: typeof body.stopOnReply === 'boolean' ? body.stopOnReply : existing.stopOnReply,
          stopOnBooking: typeof body.stopOnBooking === 'boolean' ? body.stopOnBooking : existing.stopOnBooking,
          stopOnUnsubscribe:
            typeof body.stopOnUnsubscribe === 'boolean' ? body.stopOnUnsubscribe : existing.stopOnUnsubscribe,
          launchAt: body.launchAt === undefined ? existing.launchAt : cleanDate(body.launchAt),
          completedAt: body.completedAt === undefined ? existing.completedAt : cleanDate(body.completedAt),
          updatedAt: new Date(),
        })
        .where(eq(outreachCampaigns.id, campaignId))
        .returning();
      const updatedRow = rows[0];
      if (updatedRow) {
        await createTimelineEntry(tx, {
          workspaceId: workspace.id,
          campaignId: updatedRow.id,
          kind: 'campaign_updated',
          title: buildTimelineTitle('campaign_updated', updatedRow.name),
          detail: 'Campaign settings were updated.',
        });
      }
      return rows[0] ?? null;
    });

    return NextResponse.json({ data: updated });
  }

  if (action === 'deletecampaign') {
    const campaignId = cleanText(body.campaignId);
    if (!campaignId) return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
    const [existing] = await db
      .select()
      .from(outreachCampaigns)
      .where(eq(outreachCampaigns.id, campaignId))
      .limit(1);
    if (!existing || existing.workspaceId !== workspace.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    await db.delete(outreachCampaigns).where(eq(outreachCampaigns.id, campaignId));
    return NextResponse.json({ data: { ok: true } });
  }

  if (action === 'createlead') {
    const name = cleanText(body.name);
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const campaignId = cleanText(body.campaignId) || null;
    if (campaignId) {
      const [campaign] = await db
        .select()
        .from(outreachCampaigns)
        .where(eq(outreachCampaigns.id, campaignId))
        .limit(1);
      if (!campaign || campaign.workspaceId !== workspace.id) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      }
    }

    const created = await db.transaction(async (tx) => {
      const rows = await tx
        .insert(outreachLeads)
        .values({
          workspaceId: workspace.id,
          campaignId,
          name,
          company: cleanOptionalText(body.company),
          email: cleanOptionalText(body.email),
          phone: cleanOptionalText(body.phone),
          channel: parseChannel(body.channel),
          stage: body.stage ? parseLeadStage(body.stage) : defaultLeadStageForChannel(parseChannel(body.channel)),
          source: cleanText(body.source, 'manual'),
          owner: cleanOptionalText(body.owner),
          lastContactAt: cleanDate(body.lastContactAt),
          nextFollowUpAt: cleanDate(body.nextFollowUpAt),
          notes: cleanText(body.notes),
          tags: cleanStringArray(body.tags),
        })
        .returning();
      const createdRow = rows[0];
      if (createdRow) {
        await createTimelineEntry(tx, {
          workspaceId: workspace.id,
          campaignId: createdRow.campaignId,
          leadId: createdRow.id,
          kind: 'lead_imported',
          title: buildTimelineTitle('lead_imported', createdRow.name),
          detail: createdRow.company ? `Imported from ${createdRow.company}.` : 'Lead imported into the funnel.',
        });
      }
      return rows[0] ?? null;
    });

    return NextResponse.json({ data: created });
  }

  if (action === 'updatelead') {
    const leadId = cleanText(body.leadId);
    if (!leadId) return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
    const [existing] = await db
      .select()
      .from(outreachLeads)
      .where(eq(outreachLeads.id, leadId))
      .limit(1);
    if (!existing || existing.workspaceId !== workspace.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const nextStage = body.stage === undefined ? existing.stage : parseLeadStage(body.stage);
    const updated = await db.transaction(async (tx) => {
      const rows = await tx
        .update(outreachLeads)
        .set({
          campaignId:
            body.campaignId === undefined
              ? existing.campaignId
              : cleanText(body.campaignId) || null,
          name: cleanText(body.name, existing.name),
          company: body.company === undefined ? existing.company : cleanOptionalText(body.company),
          email: body.email === undefined ? existing.email : cleanOptionalText(body.email),
          phone: body.phone === undefined ? existing.phone : cleanOptionalText(body.phone),
          channel: body.channel === undefined ? existing.channel : parseChannel(body.channel),
          stage: nextStage,
          source: body.source === undefined ? existing.source : cleanText(body.source, existing.source),
          owner: body.owner === undefined ? existing.owner : cleanOptionalText(body.owner),
          lastContactAt: body.lastContactAt === undefined ? existing.lastContactAt : cleanDate(body.lastContactAt),
          nextFollowUpAt:
            body.nextFollowUpAt === undefined ? existing.nextFollowUpAt : cleanDate(body.nextFollowUpAt),
          notes: body.notes === undefined ? existing.notes : cleanText(body.notes),
          tags: body.tags === undefined ? existing.tags : cleanStringArray(body.tags),
          updatedAt: new Date(),
        })
        .where(eq(outreachLeads.id, leadId))
        .returning();
      const updatedRow = rows[0];
      if (updatedRow && updatedRow.stage !== existing.stage) {
        await createTimelineEntry(tx, {
          workspaceId: workspace.id,
          campaignId: updatedRow.campaignId,
          leadId: updatedRow.id,
          kind: 'status_changed',
          title: buildTimelineTitle('status_changed', updatedRow.name),
          detail: `Stage changed from ${existing.stage} to ${updatedRow.stage}.`,
        });
      }
      return rows[0] ?? null;
    });

    return NextResponse.json({ data: updated });
  }

  if (action === 'deletelead') {
    const leadId = cleanText(body.leadId);
    if (!leadId) return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
    const [existing] = await db
      .select()
      .from(outreachLeads)
      .where(eq(outreachLeads.id, leadId))
      .limit(1);
    if (!existing || existing.workspaceId !== workspace.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    await db.delete(outreachLeads).where(eq(outreachLeads.id, leadId));
    return NextResponse.json({ data: { ok: true } });
  }

  if (action === 'addtimeline') {
    const leadId = cleanText(body.leadId);
    if (!leadId) return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
    const [lead] = await db.select().from(outreachLeads).where(eq(outreachLeads.id, leadId)).limit(1);
    if (!lead || lead.workspaceId !== workspace.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const created = await db.transaction(async (tx) => {
      const rows = await createTimelineEntry(tx, {
        workspaceId: workspace.id,
        campaignId: lead.campaignId,
        leadId,
        kind: parseTimelineKind(body.kind),
        title: cleanText(body.title) || buildTimelineTitle(parseTimelineKind(body.kind), lead.name),
        detail: cleanText(body.detail),
        direction: body.direction === 'inbound' ? 'inbound' : 'outbound',
        metadata: typeof body.metadata === 'object' && body.metadata && !Array.isArray(body.metadata)
          ? (body.metadata as Record<string, unknown>)
          : {},
      });
      return rows;
    });
    return NextResponse.json({ data: created });
  }

  if (action === 'logreply') {
    const leadId = cleanText(body.leadId);
    const message = cleanText(body.message);
    if (!leadId || !message) {
      return NextResponse.json({ error: 'leadId and message are required' }, { status: 400 });
    }
    const [lead] = await db.select().from(outreachLeads).where(eq(outreachLeads.id, leadId)).limit(1);
    if (!lead || lead.workspaceId !== workspace.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const replyClass = classifyOutreachReply(message);
    const nextStage = leadStageFromReply(replyClass);
    const nextFollowUpAt = nextFollowUpFromReply(replyClass);
    const { updatedLead, replyMessage } = await db.transaction(async (tx) => {
      const leadRows = await tx
        .update(outreachLeads)
        .set({
          stage: nextStage,
          lastContactAt: new Date(),
          nextFollowUpAt,
          updatedAt: new Date(),
        })
        .where(eq(outreachLeads.id, leadId))
        .returning();
      const messageRows = await tx
        .insert(outreachMessages)
        .values({
          workspaceId: workspace.id,
          campaignId: lead.campaignId,
          leadId,
          channel: parseChannel(body.channel),
          direction: 'inbound',
          status: 'replied',
          subject: cleanText(body.subject),
          body: message,
          receivedAt: new Date(),
        })
        .returning();
      await createTimelineEntry(tx, {
        workspaceId: workspace.id,
        campaignId: lead.campaignId,
        leadId,
        kind: replyTimelineKind(replyClass),
        title: buildTimelineTitle(replyTimelineKind(replyClass), lead.name),
        detail: extractReplySummary(message),
        direction: 'inbound',
        metadata: { replyClass },
      });
      return {
        updatedLead: leadRows[0] ?? null,
        replyMessage: messageRows[0] ?? null,
      };
    });

    return NextResponse.json({ data: { lead: updatedLead, message: replyMessage, replyClass } });
  }

  if (action === 'queuemessage') {
    const leadId = cleanText(body.leadId);
    const message = cleanText(body.message);
    if (!leadId || !message) {
      return NextResponse.json({ error: 'leadId and message are required' }, { status: 400 });
    }
    const [lead] = await db.select().from(outreachLeads).where(eq(outreachLeads.id, leadId)).limit(1);
    if (!lead || lead.workspaceId !== workspace.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const created = await db.transaction(async (tx) => {
      const rows = await tx
        .insert(outreachMessages)
        .values({
          workspaceId: workspace.id,
          campaignId: lead.campaignId,
          leadId,
          channel: parseChannel(body.channel),
          direction: 'outbound',
          status: parseTextStatus(body.status),
          subject: cleanText(body.subject),
          body: message,
          sentAt: body.status === 'sent' ? new Date() : null,
        })
        .returning();
      await tx
        .update(outreachLeads)
        .set({
          lastContactAt: new Date(),
          nextFollowUpAt: cleanDate(body.nextFollowUpAt) ?? lead.nextFollowUpAt,
          updatedAt: new Date(),
        })
        .where(eq(outreachLeads.id, leadId));
      await createTimelineEntry(tx, {
        workspaceId: workspace.id,
        campaignId: lead.campaignId,
        leadId,
        kind: 'message_sent',
        title: buildTimelineTitle('message_sent', lead.name),
        detail: extractReplySummary(message),
        direction: 'outbound',
        metadata: { channel: parseChannel(body.channel), status: parseTextStatus(body.status) },
      });
      return rows[0] ?? null;
    });

    return NextResponse.json({ data: created });
  }

  if (action === 'booklead') {
    const leadId = cleanText(body.leadId);
    const startsAt = cleanDate(body.startsAt);
    if (!leadId || !startsAt) {
      return NextResponse.json({ error: 'leadId and startsAt are required' }, { status: 400 });
    }
    const [lead] = await db.select().from(outreachLeads).where(eq(outreachLeads.id, leadId)).limit(1);
    if (!lead || lead.workspaceId !== workspace.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const endsAt = cleanDate(body.endsAt);
    const title = cleanText(body.title) || `Discovery call: ${lead.name}`;
    const description = cleanText(body.description, lead.company ? `${lead.company} booking from outreach.` : 'Outreach booking.');
    const createdBooking = await db.transaction(async (tx) => {
      const [event] = await tx
        .insert(calendarEvents)
        .values({
          workspaceId: workspace.id,
          title,
          description,
          startsAt,
          endsAt,
          allDay: false,
          source: 'outreach',
        })
        .returning();

      const [booking] = await tx
        .insert(outreachBookings)
        .values({
          workspaceId: workspace.id,
          campaignId: lead.campaignId,
          leadId,
          calendarEventId: event?.id ?? null,
          status: parseBookingStatus(body.status),
          startsAt,
          endsAt,
          meetingLink: cleanOptionalText(body.meetingLink),
          notes: cleanText(body.notes),
        })
        .returning();

      await tx
        .update(outreachLeads)
        .set({
          stage: 'booked',
          lastContactAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(outreachLeads.id, leadId));

      await createTimelineEntry(tx, {
        workspaceId: workspace.id,
        campaignId: lead.campaignId,
        leadId,
        kind: 'booking_created',
        title: buildTimelineTitle('booking_created', lead.name),
        detail: `${title} at ${startsAt.toLocaleString()}.`,
        direction: 'outbound',
        metadata: {
          bookingStatus: parseBookingStatus(body.status),
          calendarEventId: event?.id ?? null,
          meetingLink: cleanOptionalText(body.meetingLink),
        },
      });

      return booking ?? null;
    });

    return NextResponse.json({ data: createdBooking });
  }

  if (action === 'schedulereminder') {
    const leadId = cleanText(body.leadId);
    const reminderAt = cleanDate(body.reminderAt);
    if (!leadId || !reminderAt) {
      return NextResponse.json({ error: 'leadId and reminderAt are required' }, { status: 400 });
    }
    const [lead] = await db.select().from(outreachLeads).where(eq(outreachLeads.id, leadId)).limit(1);
    if (!lead || lead.workspaceId !== workspace.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const created = await db.transaction(async (tx) => {
      const rows = await tx
        .insert(outreachReminders)
        .values({
          workspaceId: workspace.id,
          campaignId: lead.campaignId,
          leadId,
          status: parseReminderStatus(body.status),
          channel: parseChannel(body.channel),
          reminderAt,
          message: cleanText(body.message),
          sentAt: body.status === 'sent' ? new Date() : null,
        })
        .returning();
      await createTimelineEntry(tx, {
        workspaceId: workspace.id,
        campaignId: lead.campaignId,
        leadId,
        kind: 'reminder_created',
        title: buildTimelineTitle('reminder_created', lead.name),
        detail: `${cleanText(body.message) || 'Reminder scheduled'} for ${reminderAt.toLocaleString()}.`,
        direction: 'outbound',
        metadata: { reminderAt: reminderAt.toISOString(), status: parseReminderStatus(body.status) },
      });
      return rows[0] ?? null;
    });

    return NextResponse.json({ data: created });
  }

  if (action === 'createsequencestep') {
    const campaignId = cleanText(body.campaignId);
    if (!campaignId) return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
    const [campaign] = await db
      .select()
      .from(outreachCampaigns)
      .where(eq(outreachCampaigns.id, campaignId))
      .limit(1);
    if (!campaign || campaign.workspaceId !== workspace.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const [created] = await db
      .insert(outreachSequenceSteps)
      .values({
        workspaceId: workspace.id,
        campaignId,
        position: typeof body.position === 'number' ? Math.max(1, Math.floor(body.position)) : 1,
        stepKind: parseStepKind(body.stepKind),
        delayMinutes: typeof body.delayMinutes === 'number' ? Math.max(0, Math.floor(body.delayMinutes)) : 0,
        subject: cleanText(body.subject),
        body: cleanText(body.body),
        notes: cleanText(body.notes),
        enabled: body.enabled !== false,
      })
      .returning();

    return NextResponse.json({ data: created });
  }

  if (action === 'updatesequencestep') {
    const stepId = cleanText(body.stepId);
    if (!stepId) return NextResponse.json({ error: 'stepId is required' }, { status: 400 });
    const [step] = await db
      .select()
      .from(outreachSequenceSteps)
      .where(eq(outreachSequenceSteps.id, stepId))
      .limit(1);
    if (!step || step.workspaceId !== workspace.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const [updated] = await db
      .update(outreachSequenceSteps)
      .set({
        position: typeof body.position === 'number' ? Math.max(1, Math.floor(body.position)) : step.position,
        stepKind: body.stepKind === undefined ? step.stepKind : parseStepKind(body.stepKind),
        delayMinutes:
          typeof body.delayMinutes === 'number' ? Math.max(0, Math.floor(body.delayMinutes)) : step.delayMinutes,
        subject: body.subject === undefined ? step.subject : cleanText(body.subject),
        body: body.body === undefined ? step.body : cleanText(body.body),
        notes: body.notes === undefined ? step.notes : cleanText(body.notes),
        enabled: typeof body.enabled === 'boolean' ? body.enabled : step.enabled,
        updatedAt: new Date(),
      })
      .where(eq(outreachSequenceSteps.id, stepId))
      .returning();
    return NextResponse.json({ data: updated });
  }

  if (action === 'deletesequencestep') {
    const stepId = cleanText(body.stepId);
    if (!stepId) return NextResponse.json({ error: 'stepId is required' }, { status: 400 });
    const [step] = await db
      .select()
      .from(outreachSequenceSteps)
      .where(eq(outreachSequenceSteps.id, stepId))
      .limit(1);
    if (!step || step.workspaceId !== workspace.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    await db.delete(outreachSequenceSteps).where(eq(outreachSequenceSteps.id, stepId));
    return NextResponse.json({ data: { ok: true } });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
