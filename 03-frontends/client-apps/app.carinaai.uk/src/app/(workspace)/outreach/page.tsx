'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  ExternalLink,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type OutreachCampaignStatus = 'draft' | 'active' | 'paused' | 'completed';
type OutreachLeadStage =
  | 'prospect'
  | 'queued'
  | 'contacted'
  | 'replied'
  | 'booked'
  | 'nurturing'
  | 'won'
  | 'lost'
  | 'unsubscribed';
type OutreachChannel = 'email' | 'whatsapp' | 'sms' | 'phone' | 'telegram' | 'linkedin' | 'manual';
type OutreachMessageStatus = 'draft' | 'queued' | 'sent' | 'delivered' | 'failed' | 'replied';
type OutreachReminderStatus = 'scheduled' | 'sent' | 'cancelled';
type OutreachBookingStatus = 'tentative' | 'confirmed' | 'rescheduled' | 'cancelled';

type CampaignRow = {
  id: string;
  name: string;
  description: string;
  status: OutreachCampaignStatus;
  channel: OutreachChannel;
  audience: string;
  dailyTarget: number;
  stopOnReply: boolean;
  stopOnBooking: boolean;
  stopOnUnsubscribe: boolean;
  launchAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type LeadRow = {
  id: string;
  campaignId: string | null;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  channel: OutreachChannel;
  stage: OutreachLeadStage;
  source: string;
  owner: string | null;
  lastContactAt: string | null;
  nextFollowUpAt: string | null;
  notes: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type SequenceStepRow = {
  id: string;
  campaignId: string;
  position: number;
  stepKind: 'email' | 'whatsapp' | 'sms' | 'phone' | 'wait' | 'manual';
  delayMinutes: number;
  subject: string;
  body: string;
  notes: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type TimelineRow = {
  id: string;
  campaignId: string | null;
  leadId: string | null;
  kind: string;
  title: string;
  detail: string;
  direction: 'outbound' | 'inbound';
  metadata: Record<string, unknown>;
  createdAt: string;
};

type MessageRow = {
  id: string;
  campaignId: string | null;
  leadId: string;
  channel: OutreachChannel;
  direction: 'outbound' | 'inbound';
  status: OutreachMessageStatus;
  subject: string;
  body: string;
  externalId: string | null;
  sentAt: string | null;
  receivedAt: string | null;
  createdAt: string;
};

type BookingRow = {
  id: string;
  campaignId: string | null;
  leadId: string;
  calendarEventId: string | null;
  status: OutreachBookingStatus;
  startsAt: string;
  endsAt: string | null;
  meetingLink: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type ReminderRow = {
  id: string;
  campaignId: string | null;
  leadId: string;
  status: OutreachReminderStatus;
  channel: OutreachChannel;
  reminderAt: string;
  message: string;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type OutreachSummary = {
  campaignCount: number;
  activeCampaigns: number;
  leadCount: number;
  repliedLeads: number;
  bookedLeads: number;
  dueFollowUps: number;
};

type OutreachState = {
  campaigns: CampaignRow[];
  leads: LeadRow[];
  steps: SequenceStepRow[];
  timeline: TimelineRow[];
  messages: MessageRow[];
  bookings: BookingRow[];
  reminders: ReminderRow[];
  summary: OutreachSummary;
};

const STAGES: OutreachLeadStage[] = [
  'prospect',
  'queued',
  'contacted',
  'replied',
  'booked',
  'nurturing',
  'won',
  'lost',
  'unsubscribed',
];

const STAGE_LABELS: Record<OutreachLeadStage, string> = {
  prospect: 'Prospect',
  queued: 'Queued',
  contacted: 'Contacted',
  replied: 'Replied',
  booked: 'Booked',
  nurturing: 'Nurturing',
  won: 'Won',
  lost: 'Lost',
  unsubscribed: 'Unsubscribed',
};

const STAGE_HELP: Record<OutreachLeadStage, string> = {
  prospect: 'Fresh lead not yet contacted.',
  queued: 'Ready for the next sequence step.',
  contacted: 'Initial outreach has been sent.',
  replied: 'Lead has responded and needs attention.',
  booked: 'Discovery or follow-up call confirmed.',
  nurturing: 'Warm but not ready yet.',
  won: 'Converted or handed over.',
  lost: 'Closed out or declined.',
  unsubscribed: 'Must not be contacted again.',
};

const CAMPAIGN_STATUS_BADGE: Record<OutreachCampaignStatus, 'draft' | 'active' | 'paused' | 'default'> = {
  draft: 'draft',
  active: 'active',
  paused: 'paused',
  completed: 'default',
};

const MESSAGE_STATUS_LABELS: Record<OutreachMessageStatus, string> = {
  draft: 'Draft',
  queued: 'Queued',
  sent: 'Sent',
  delivered: 'Delivered',
  failed: 'Failed',
  replied: 'Replied',
};

const REMINDER_STATUS_LABELS: Record<OutreachReminderStatus, string> = {
  scheduled: 'Scheduled',
  sent: 'Sent',
  cancelled: 'Cancelled',
};

const BOOKING_STATUS_LABELS: Record<OutreachBookingStatus, string> = {
  tentative: 'Tentative',
  confirmed: 'Confirmed',
  rescheduled: 'Rescheduled',
  cancelled: 'Cancelled',
};

const CAMPAIGN_STATUS_LABELS: Record<OutreachCampaignStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
};

const EMPTY_CAMPAIGN = {
  name: '',
  description: '',
  channel: 'email' as OutreachChannel,
  audience: '',
  dailyTarget: 20,
  status: 'draft' as OutreachCampaignStatus,
};

const EMPTY_LEAD = {
  campaignId: '',
  name: '',
  company: '',
  email: '',
  phone: '',
  channel: 'email' as OutreachChannel,
  stage: 'prospect' as OutreachLeadStage,
  source: 'manual',
  owner: '',
  notes: '',
  tags: '',
  nextFollowUpAt: '',
};

const EMPTY_STEP = {
  campaignId: '',
  position: 1,
  stepKind: 'email' as const,
  delayMinutes: 0,
  subject: '',
  body: '',
  notes: '',
  enabled: true,
};

const EMPTY_REPLY = {
  channel: 'email' as OutreachChannel,
  subject: '',
  message: '',
};

const EMPTY_BOOKING = {
  startsAt: '',
  endsAt: '',
  title: '',
  description: '',
  meetingLink: '',
  status: 'confirmed' as OutreachBookingStatus,
};

const EMPTY_REMINDER = {
  reminderAt: '',
  channel: 'email' as OutreachChannel,
  message: '',
  status: 'scheduled' as OutreachReminderStatus,
};

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleString([], {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateTimeInput(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function tagList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function badgeForCampaign(status: OutreachCampaignStatus) {
  return CAMPAIGN_STATUS_BADGE[status];
}

function stageClass(stage: OutreachLeadStage) {
  switch (stage) {
    case 'booked':
    case 'won':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    case 'replied':
    case 'nurturing':
      return 'border-blue-500/30 bg-blue-500/10 text-blue-300';
    case 'lost':
    case 'unsubscribed':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-300';
    case 'queued':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
    default:
      return 'border-border bg-elevated text-text-muted';
  }
}

function messageStatusClass(status: OutreachMessageStatus) {
  if (status === 'failed') return 'border-rose-500/30 bg-rose-500/10 text-rose-300';
  if (status === 'sent' || status === 'delivered') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  if (status === 'replied') return 'border-blue-500/30 bg-blue-500/10 text-blue-300';
  return 'border-border bg-elevated text-text-muted';
}

function timelineLabel(kind: string) {
  switch (kind) {
    case 'lead_imported':
      return 'Lead added';
    case 'campaign_created':
      return 'Campaign created';
    case 'campaign_updated':
      return 'Campaign updated';
    case 'message_sent':
      return 'Message sent';
    case 'reply_received':
      return 'Reply received';
    case 'booking_created':
      return 'Booking created';
    case 'reminder_created':
      return 'Reminder scheduled';
    case 'status_changed':
      return 'Status changed';
    case 'handoff_created':
      return 'Handoff created';
    case 'note_added':
      return 'Note added';
    default:
      return kind;
  }
}

function sortByPositionThenDate(a: SequenceStepRow, b: SequenceStepRow) {
  if (a.position !== b.position) return a.position - b.position;
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

export default function OutreachPage() {
  const [data, setData] = useState<OutreachState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [campaignForm, setCampaignForm] = useState(EMPTY_CAMPAIGN);
  const [leadForm, setLeadForm] = useState(EMPTY_LEAD);
  const [stepForm, setStepForm] = useState(EMPTY_STEP);
  const [replyForm, setReplyForm] = useState(EMPTY_REPLY);
  const [bookingForm, setBookingForm] = useState(EMPTY_BOOKING);
  const [reminderForm, setReminderForm] = useState(EMPTY_REMINDER);

  const selectedLead = useMemo(() => {
    if (!data) return null;
    const visibleLeads = campaignFilter === 'all'
      ? data.leads
      : data.leads.filter((lead) => lead.campaignId === campaignFilter);
    return visibleLeads.find((lead) => lead.id === selectedLeadId) ?? visibleLeads[0] ?? null;
  }, [data, selectedLeadId, campaignFilter]);

  const filteredLeads = useMemo(() => {
    if (!data) return [];
    if (campaignFilter === 'all') return data.leads;
    return data.leads.filter((lead) => lead.campaignId === campaignFilter);
  }, [data, campaignFilter]);

  const timelineForLead = useMemo(() => {
    if (!selectedLead) return [];
    return data?.timeline.filter((item) => item.leadId === selectedLead.id) ?? [];
  }, [data?.timeline, selectedLead]);

  const messagesForLead = useMemo(() => {
    if (!selectedLead) return [];
    return data?.messages.filter((item) => item.leadId === selectedLead.id) ?? [];
  }, [data?.messages, selectedLead]);

  const bookingsForLead = useMemo(() => {
    if (!selectedLead) return [];
    return data?.bookings.filter((item) => item.leadId === selectedLead.id) ?? [];
  }, [data?.bookings, selectedLead]);

  const remindersForLead = useMemo(() => {
    if (!selectedLead) return [];
    return data?.reminders.filter((item) => item.leadId === selectedLead.id) ?? [];
  }, [data?.reminders, selectedLead]);

  const stepsForFilteredCampaigns = useMemo(() => {
    if (!data) return [];
    if (campaignFilter === 'all') return data.steps.slice().sort(sortByPositionThenDate);
    return data.steps.filter((step) => step.campaignId === campaignFilter).sort(sortByPositionThenDate);
  }, [data, campaignFilter]);

  const selectedCampaign = useMemo(() => {
    if (!data) return null;
    if (campaignFilter === 'all') return data.campaigns[0] ?? null;
    return data.campaigns.find((campaign) => campaign.id === campaignFilter) ?? null;
  }, [data, campaignFilter]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/outreach');
      const json = (await res.json().catch(() => ({}))) as { data?: OutreachState; error?: string };
      if (!res.ok) {
        setError(json.error ?? 'Could not load outreach data');
        setData(null);
      } else {
        setData(json.data ?? null);
      }
    } catch {
      setError('Could not load outreach data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!data) return;
    if (selectedLeadId && data.leads.some((lead) => lead.id === selectedLeadId)) return;
    setSelectedLeadId(data.leads[0]?.id ?? null);
  }, [data, selectedLeadId]);

  useEffect(() => {
    if (!selectedLead) return;
    setReplyForm({
      channel: selectedLead.channel,
      subject: '',
      message: '',
    });
    setBookingForm({
      startsAt: '',
      endsAt: '',
      title: `Discovery call: ${selectedLead.name}`,
      description: selectedLead.company ? `${selectedLead.company} outreach booking.` : '',
      meetingLink: '',
      status: 'confirmed',
    });
    setReminderForm({
      reminderAt: '',
      channel: selectedLead.channel,
      message: '',
      status: 'scheduled',
    });
  }, [selectedLead?.id]);

  function chooseCampaignFilter(next: string) {
    setCampaignFilter(next);
    if (next !== 'all' && data) {
      const lead = data.leads.find((item) => item.campaignId === next) ?? data.leads[0] ?? null;
      setSelectedLeadId(lead?.id ?? null);
    }
  }

  async function submit(action: string, payload: Record<string, unknown>, onDone?: () => void) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      const json = (await res.json().catch(() => ({}))) as { data?: unknown; error?: string };
      if (!res.ok) {
        setError(json.error ?? 'Action failed');
        return;
      }
      onDone?.();
      await load();
    } catch {
      setError('Action failed');
    } finally {
      setSaving(false);
    }
  }

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submit('createCampaign', {
      name: campaignForm.name,
      description: campaignForm.description,
      channel: campaignForm.channel,
      audience: campaignForm.audience,
      dailyTarget: campaignForm.dailyTarget,
      status: campaignForm.status,
      stopOnReply: true,
      stopOnBooking: true,
      stopOnUnsubscribe: true,
    }, () => setCampaignForm(EMPTY_CAMPAIGN));
  }

  async function createLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submit('createLead', {
      campaignId: leadForm.campaignId || null,
      name: leadForm.name,
      company: leadForm.company,
      email: leadForm.email,
      phone: leadForm.phone,
      channel: leadForm.channel,
      stage: leadForm.stage,
      source: leadForm.source,
      owner: leadForm.owner,
      notes: leadForm.notes,
      tags: tagList(leadForm.tags),
      nextFollowUpAt: leadForm.nextFollowUpAt ? new Date(leadForm.nextFollowUpAt).toISOString() : null,
    }, () => setLeadForm(EMPTY_LEAD));
  }

  async function createStep(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submit('createSequenceStep', {
      campaignId: stepForm.campaignId || selectedCampaign?.id || null,
      position: stepForm.position,
      stepKind: stepForm.stepKind,
      delayMinutes: stepForm.delayMinutes,
      subject: stepForm.subject,
      body: stepForm.body,
      notes: stepForm.notes,
      enabled: stepForm.enabled,
    }, () => setStepForm(EMPTY_STEP));
  }

  async function saveLead(updates: Partial<Record<string, unknown>>) {
    if (!selectedLead) return;
    await submit('updateLead', { leadId: selectedLead.id, ...updates });
  }

  async function logReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLead) return;
    await submit('logReply', {
      leadId: selectedLead.id,
      channel: replyForm.channel,
      subject: replyForm.subject,
      message: replyForm.message,
    }, () => setReplyForm({ channel: selectedLead.channel, subject: '', message: '' }));
  }

  async function createBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLead) return;
    await submit('bookLead', {
      leadId: selectedLead.id,
      startsAt: bookingForm.startsAt ? new Date(bookingForm.startsAt).toISOString() : null,
      endsAt: bookingForm.endsAt ? new Date(bookingForm.endsAt).toISOString() : null,
      title: bookingForm.title,
      description: bookingForm.description,
      meetingLink: bookingForm.meetingLink,
      status: bookingForm.status,
    }, () => setBookingForm({
      startsAt: '',
      endsAt: '',
      title: `Discovery call: ${selectedLead.name}`,
      description: selectedLead.company ? `${selectedLead.company} outreach booking.` : '',
      meetingLink: '',
      status: 'confirmed',
    }));
  }

  async function createReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLead) return;
    await submit('scheduleReminder', {
      leadId: selectedLead.id,
      reminderAt: reminderForm.reminderAt ? new Date(reminderForm.reminderAt).toISOString() : null,
      channel: reminderForm.channel,
      message: reminderForm.message,
      status: reminderForm.status,
    }, () => setReminderForm({
      reminderAt: '',
      channel: selectedLead.channel,
      message: '',
      status: 'scheduled',
    }));
  }

  const boardColumns = useMemo(
    () =>
      STAGES.map((stage) => ({
        stage,
        leads: filteredLeads.filter((lead) => lead.stage === stage),
      })),
    [filteredLeads],
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-base">
      <div className="shrink-0 border-b border-border bg-base/90 px-4 py-4 backdrop-blur">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="active">Outreach</Badge>
              <span className="text-xs uppercase tracking-[0.24em] text-text-muted">Lead funnel</span>
            </div>
            <h1 className="text-2xl font-semibold text-text-primary">Outreach pipeline</h1>
            <p className="max-w-3xl text-sm text-text-muted">
              Manage campaigns, follow-ups, replies, bookings, reminders, and handoffs from one place.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/email">
                <Send className="mr-2 h-4 w-4" />
                Open email
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/calendar">
                <CalendarClock className="mr-2 h-4 w-4" />
                Open calendar
              </Link>
            </Button>
            <Button variant="outline" onClick={() => void load()} disabled={saving || loading}>
              <RefreshCw className={cn('mr-2 h-4 w-4', loading ? 'animate-spin' : '')} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        {error ? (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {loading && !data ? (
          <div className="flex h-60 items-center justify-center">
            <Spinner />
          </div>
        ) : null}

        {!loading && data ? (
          <div className="grid min-h-0 gap-4 xl:grid-cols-[360px_minmax(0,1fr)_420px]">
            <div className="min-h-0 space-y-4">
              <section className="rounded-2xl border border-border bg-elevated/60 p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary">Summary</h2>
                    <p className="text-xs text-text-muted">Campaign health and current state.</p>
                  </div>
                  <Badge variant={data.summary.activeCampaigns > 0 ? 'active' : 'draft'}>
                    {data.summary.activeCampaigns} active
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Campaigns" value={data.summary.campaignCount} />
                  <StatCard label="Leads" value={data.summary.leadCount} />
                  <StatCard label="Replies" value={data.summary.repliedLeads} />
                  <StatCard label="Booked" value={data.summary.bookedLeads} />
                </div>
                <div className="mt-3 rounded-xl border border-border bg-base/80 px-3 py-2 text-xs text-text-muted">
                  Due follow-ups: <span className="font-medium text-text-primary">{data.summary.dueFollowUps}</span>
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-elevated/60 p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary">Campaigns</h2>
                    <p className="text-xs text-text-muted">Launch, pause, or inspect a campaign.</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => chooseCampaignFilter('all')}>
                    All
                  </Button>
                </div>
                <div className="space-y-2">
                  {data.campaigns.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-text-muted">
                      No campaigns yet. Create one below.
                    </p>
                  ) : (
                    data.campaigns.map((campaign) => (
                      <button
                        key={campaign.id}
                        type="button"
                        onClick={() => chooseCampaignFilter(campaign.id)}
                        className={cn(
                          'w-full rounded-xl border px-3 py-3 text-left transition-colors',
                          campaignFilter === campaign.id
                            ? 'border-accent/40 bg-accent/10'
                            : 'border-border bg-base/80 hover:border-accent/30 hover:bg-accent/5',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-text-primary">{campaign.name}</p>
                            <p className="text-xs text-text-muted">{campaign.audience || campaign.description || 'Campaign'}</p>
                          </div>
                          <Badge variant={badgeForCampaign(campaign.status)}>{CAMPAIGN_STATUS_LABELS[campaign.status]}</Badge>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-text-muted">
                          <span>{campaign.channel}</span>
                          <span>Target {campaign.dailyTarget}</span>
                          <span>{formatDate(campaign.updatedAt)}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-elevated/60 p-4 shadow-sm">
                <div className="mb-3">
                  <h2 className="text-sm font-semibold text-text-primary">New campaign</h2>
                  <p className="text-xs text-text-muted">Create a funnel that follows until reply, booking, or unsubscribe.</p>
                </div>
                <form className="space-y-3" onSubmit={createCampaign}>
                  <Input
                    placeholder="Campaign name"
                    value={campaignForm.name}
                    onChange={(e: any) => setCampaignForm((current) => ({ ...current, name: e.target.value }))}
                  />
                  <Textarea
                    placeholder="Audience or offer"
                    value={campaignForm.audience}
                    onChange={(e: any) => setCampaignForm((current) => ({ ...current, audience: e.target.value }))}
                  />
                  <Textarea
                    placeholder="Campaign description"
                    value={campaignForm.description}
                    onChange={(e: any) => setCampaignForm((current) => ({ ...current, description: e.target.value }))}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="number"
                      min={0}
                      placeholder="Daily target"
                      value={campaignForm.dailyTarget}
                      onChange={(e: any) =>
                        setCampaignForm((current) => ({ ...current, dailyTarget: Number(e.target.value) || 0 }))
                      }
                    />
                    <select
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={campaignForm.channel}
                      onChange={(e: any) =>
                        setCampaignForm((current) => ({ ...current, channel: e.target.value as OutreachChannel }))
                      }
                    >
                      <option value="email">Email</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="sms">SMS</option>
                      <option value="phone">Phone</option>
                      <option value="telegram">Telegram</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="manual">Manual</option>
                    </select>
                  </div>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={campaignForm.status}
                    onChange={(e: any) =>
                      setCampaignForm((current) => ({ ...current, status: e.target.value as OutreachCampaignStatus }))
                    }
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="completed">Completed</option>
                  </select>
                  <Button type="submit" disabled={saving}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create campaign
                  </Button>
                </form>
              </section>

              <section className="rounded-2xl border border-border bg-elevated/60 p-4 shadow-sm">
                <div className="mb-3">
                  <h2 className="text-sm font-semibold text-text-primary">New lead</h2>
                  <p className="text-xs text-text-muted">Add a lead to a campaign or start with a manual prospect.</p>
                </div>
                <form className="space-y-3" onSubmit={createLead}>
                  <Input
                    placeholder="Lead name"
                    value={leadForm.name}
                    onChange={(e: any) => setLeadForm((current) => ({ ...current, name: e.target.value }))}
                  />
                  <Input
                    placeholder="Company"
                    value={leadForm.company}
                    onChange={(e: any) => setLeadForm((current) => ({ ...current, company: e.target.value }))}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="Email"
                      value={leadForm.email}
                      onChange={(e: any) => setLeadForm((current) => ({ ...current, email: e.target.value }))}
                    />
                    <Input
                      placeholder="Phone"
                      value={leadForm.phone}
                      onChange={(e: any) => setLeadForm((current) => ({ ...current, phone: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={leadForm.campaignId}
                      onChange={(e: any) => setLeadForm((current) => ({ ...current, campaignId: e.target.value }))}
                    >
                      <option value="">No campaign</option>
                      {data.campaigns.map((campaign) => (
                        <option key={campaign.id} value={campaign.id}>
                          {campaign.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={leadForm.channel}
                      onChange={(e: any) => setLeadForm((current) => ({ ...current, channel: e.target.value as OutreachChannel }))}
                    >
                      <option value="email">Email</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="sms">SMS</option>
                      <option value="phone">Phone</option>
                      <option value="telegram">Telegram</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="manual">Manual</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={leadForm.stage}
                      onChange={(e: any) => setLeadForm((current) => ({ ...current, stage: e.target.value as OutreachLeadStage }))}
                    >
                      {STAGES.map((stage) => (
                        <option key={stage} value={stage}>
                          {STAGE_LABELS[stage]}
                        </option>
                      ))}
                    </select>
                    <Input
                      placeholder="Owner"
                      value={leadForm.owner}
                      onChange={(e: any) => setLeadForm((current) => ({ ...current, owner: e.target.value }))}
                    />
                  </div>
                  <Input
                    placeholder="Tags, comma separated"
                    value={leadForm.tags}
                    onChange={(e: any) => setLeadForm((current) => ({ ...current, tags: e.target.value }))}
                  />
                  <Input
                    type="datetime-local"
                    value={leadForm.nextFollowUpAt}
                    onChange={(e: any) =>
                      setLeadForm((current) => ({ ...current, nextFollowUpAt: e.target.value }))
                    }
                  />
                  <Textarea
                    placeholder="Lead notes"
                    value={leadForm.notes}
                    onChange={(e: any) => setLeadForm((current) => ({ ...current, notes: e.target.value }))}
                  />
                  <Button type="submit" disabled={saving}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create lead
                  </Button>
                </form>
              </section>

              <section className="rounded-2xl border border-border bg-elevated/60 p-4 shadow-sm">
                <div className="mb-3">
                  <h2 className="text-sm font-semibold text-text-primary">Sequence step</h2>
                  <p className="text-xs text-text-muted">Define the next touchpoint in the campaign.</p>
                </div>
                <form className="space-y-3" onSubmit={createStep}>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={stepForm.campaignId || selectedCampaign?.id || ''}
                    onChange={(e: any) => setStepForm((current) => ({ ...current, campaignId: e.target.value }))}
                  >
                    <option value="">Choose campaign</option>
                    {data.campaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="number"
                      min={1}
                      value={stepForm.position}
                      onChange={(e: any) => setStepForm((current) => ({ ...current, position: Number(e.target.value) || 1 }))}
                    />
                    <Input
                      type="number"
                      min={0}
                      placeholder="Delay minutes"
                      value={stepForm.delayMinutes}
                      onChange={(e: any) =>
                        setStepForm((current) => ({ ...current, delayMinutes: Number(e.target.value) || 0 }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={stepForm.stepKind}
                      onChange={(e: any) => setStepForm((current) => ({ ...current, stepKind: e.target.value as typeof stepForm.stepKind }))}
                    >
                      <option value="email">Email</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="sms">SMS</option>
                      <option value="phone">Phone</option>
                      <option value="wait">Wait</option>
                      <option value="manual">Manual</option>
                    </select>
                    <label className="flex items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-text-muted">
                      <input
                        type="checkbox"
                        checked={stepForm.enabled}
                        onChange={(e: any) => setStepForm((current) => ({ ...current, enabled: e.target.checked }))}
                      />
                      Enabled
                    </label>
                  </div>
                  <Input
                    placeholder="Subject"
                    value={stepForm.subject}
                    onChange={(e: any) => setStepForm((current) => ({ ...current, subject: e.target.value }))}
                  />
                  <Textarea
                    placeholder="Message body"
                    value={stepForm.body}
                    onChange={(e: any) => setStepForm((current) => ({ ...current, body: e.target.value }))}
                  />
                  <Textarea
                    placeholder="Notes"
                    value={stepForm.notes}
                    onChange={(e: any) => setStepForm((current) => ({ ...current, notes: e.target.value }))}
                  />
                  <Button type="submit" disabled={saving}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add step
                  </Button>
                </form>
              </section>
            </div>

            <div className="min-h-0 space-y-4">
              <section className="rounded-2xl border border-border bg-elevated/60 p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary">Kanban board</h2>
                    <p className="text-xs text-text-muted">Lead flow from prospect to handoff.</p>
                  </div>
                  <div className="text-xs text-text-muted">
                    {campaignFilter === 'all' ? 'All campaigns' : selectedCampaign?.name ?? 'Selected campaign'}
                  </div>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {boardColumns.map((column) => (
                    <div key={column.stage} className="w-[270px] shrink-0">
                      <div className="mb-2 rounded-xl border border-border bg-base/80 px-3 py-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-text-primary">{STAGE_LABELS[column.stage]}</p>
                            <p className="text-xs text-text-muted">{STAGE_HELP[column.stage]}</p>
                          </div>
                          <Badge variant={column.stage === 'booked' || column.stage === 'won' ? 'active' : column.stage === 'lost' || column.stage === 'unsubscribed' ? 'error' : column.stage === 'queued' ? 'paused' : 'default'}>
                            {column.leads.length}
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {column.leads.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-border px-3 py-4 text-xs text-text-muted">
                            No leads here.
                          </div>
                        ) : (
                          column.leads.map((lead) => (
                            <button
                              key={lead.id}
                              type="button"
                              onClick={() => setSelectedLeadId(lead.id)}
                              className={cn(
                                'w-full rounded-xl border px-3 py-3 text-left transition-colors',
                                selectedLead?.id === lead.id
                                  ? 'border-accent/40 bg-accent/10'
                                  : 'border-border bg-base/80 hover:border-accent/30 hover:bg-accent/5',
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <p className="text-sm font-medium text-text-primary">{lead.name}</p>
                                  <p className="text-xs text-text-muted">{lead.company || lead.email || lead.phone || lead.source}</p>
                                </div>
                                <Badge variant={stageClass(lead.stage).includes('rose') ? 'error' : lead.stage === 'booked' || lead.stage === 'won' ? 'active' : lead.stage === 'queued' ? 'paused' : 'default'}>
                                  {STAGE_LABELS[lead.stage]}
                                </Badge>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-text-muted">
                                <span>{lead.channel}</span>
                                <span>{lead.tags.join(', ') || 'No tags'}</span>
                                <span>{formatDate(lead.nextFollowUpAt)}</span>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-elevated/60 p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary">Sequence steps</h2>
                    <p className="text-xs text-text-muted">Ordered steps for the selected campaign or all campaigns.</p>
                  </div>
                  <Badge variant="default">{stepsForFilteredCampaigns.length}</Badge>
                </div>
                <div className="space-y-2">
                  {stepsForFilteredCampaigns.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-text-muted">
                      No steps yet.
                    </div>
                  ) : (
                    stepsForFilteredCampaigns.map((step) => (
                      <div key={step.id} className="rounded-xl border border-border bg-base/80 px-3 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-text-primary">
                              Step {step.position}: {step.stepKind}
                            </p>
                            <p className="text-xs text-text-muted">
                              Delay {step.delayMinutes} minutes, {step.enabled ? 'enabled' : 'disabled'}
                            </p>
                          </div>
                          <Badge variant={step.enabled ? 'active' : 'paused'}>{step.enabled ? 'On' : 'Off'}</Badge>
                        </div>
                        {step.subject ? <p className="mt-2 text-xs text-text-secondary">{step.subject}</p> : null}
                        {step.body ? <p className="mt-1 text-xs text-text-muted">{step.body}</p> : null}
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-elevated/60 p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary">Campaign switcher</h2>
                    <p className="text-xs text-text-muted">Filter the board by campaign.</p>
                  </div>
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={campaignFilter}
                    onChange={(e: any) => chooseCampaignFilter(e.target.value)}
                  >
                    <option value="all">All campaigns</option>
                    {data.campaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {data.campaigns.map((campaign) => (
                    <button
                      key={campaign.id}
                      type="button"
                      onClick={() => chooseCampaignFilter(campaign.id)}
                      className={cn(
                        'rounded-xl border px-3 py-3 text-left transition-colors',
                        campaignFilter === campaign.id
                          ? 'border-accent/40 bg-accent/10'
                          : 'border-border bg-base/80 hover:border-accent/30 hover:bg-accent/5',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-text-primary">{campaign.name}</p>
                        <Badge variant={badgeForCampaign(campaign.status)}>{CAMPAIGN_STATUS_LABELS[campaign.status]}</Badge>
                      </div>
                      <div className="mt-2 text-xs text-text-muted">{campaign.audience || campaign.description}</div>
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <div className="min-h-0 space-y-4">
              <section className="rounded-2xl border border-border bg-elevated/60 p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary">Lead detail</h2>
                    <p className="text-xs text-text-muted">Update the active lead without leaving the page.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/calendar">
                        <ExternalLink className="mr-2 h-3.5 w-3.5" />
                        Calendar
                      </Link>
                    </Button>
                  </div>
                </div>

                {selectedLead ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border bg-base/80 px-3 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-base font-medium text-text-primary">{selectedLead.name}</p>
                          <p className="text-xs text-text-muted">{selectedLead.company || selectedLead.email || 'Lead record'}</p>
                        </div>
                        <Badge variant={selectedLead.stage === 'booked' || selectedLead.stage === 'won' ? 'active' : selectedLead.stage === 'lost' || selectedLead.stage === 'unsubscribed' ? 'error' : selectedLead.stage === 'queued' ? 'paused' : 'default'}>
                          {STAGE_LABELS[selectedLead.stage]}
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-text-muted">
                        <div>Channel: {selectedLead.channel}</div>
                        <div>Source: {selectedLead.source}</div>
                        <div>Last contact: {formatDate(selectedLead.lastContactAt)}</div>
                        <div>Next follow-up: {formatDate(selectedLead.nextFollowUpAt)}</div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <select
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        value={selectedLead.stage}
                        onChange={(e: any) => void saveLead({ stage: e.target.value })}
                      >
                        {STAGES.map((stage) => (
                          <option key={stage} value={stage}>
                            {STAGE_LABELS[stage]}
                          </option>
                        ))}
                      </select>
                      <Input
                        type="datetime-local"
                        value={formatDateTimeInput(selectedLead.nextFollowUpAt)}
                        onChange={(e: any) => void saveLead({ nextFollowUpAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                      />
                    </div>
                    <Textarea
                      value={selectedLead.notes}
                      onChange={(e: any) => setData((current) => {
                        if (!current) return current;
                        return {
                          ...current,
                          leads: current.leads.map((lead) =>
                            lead.id === selectedLead.id ? { ...lead, notes: e.target.value } : lead,
                          ),
                        };
                      })}
                    />
                    <Button onClick={() => void saveLead({ notes: selectedLead.notes })} disabled={saving}>
                      Save lead
                    </Button>

                    <div className="space-y-2 rounded-xl border border-border bg-base/80 p-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                        <MessageSquare className="h-4 w-4" />
                        Reply router
                      </div>
                      <form className="space-y-2" onSubmit={logReply}>
                        <select
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          value={replyForm.channel}
                          onChange={(e: any) => setReplyForm((current) => ({ ...current, channel: e.target.value as OutreachChannel }))}
                        >
                          <option value="email">Email</option>
                          <option value="whatsapp">WhatsApp</option>
                          <option value="sms">SMS</option>
                          <option value="phone">Phone</option>
                          <option value="telegram">Telegram</option>
                          <option value="linkedin">LinkedIn</option>
                          <option value="manual">Manual</option>
                        </select>
                        <Input
                          placeholder="Subject"
                          value={replyForm.subject}
                          onChange={(e: any) => setReplyForm((current) => ({ ...current, subject: e.target.value }))}
                        />
                        <Textarea
                          placeholder="Paste reply or draft here"
                          value={replyForm.message}
                          onChange={(e: any) => setReplyForm((current) => ({ ...current, message: e.target.value }))}
                        />
                        <div className="flex gap-2">
                          <Button type="submit" disabled={saving}>
                            Log reply
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              void submit('queueMessage', {
                                leadId: selectedLead.id,
                                channel: replyForm.channel,
                                subject: replyForm.subject,
                                message: replyForm.message,
                                status: 'queued',
                              })
                            }
                            disabled={saving}
                          >
                            Queue message
                          </Button>
                        </div>
                      </form>
                    </div>

                    <div className="space-y-2 rounded-xl border border-border bg-base/80 p-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                        <CalendarClock className="h-4 w-4" />
                        Booking
                      </div>
                      <form className="space-y-2" onSubmit={createBooking}>
                        <Input
                          type="datetime-local"
                          value={bookingForm.startsAt}
                          onChange={(e: any) => setBookingForm((current) => ({ ...current, startsAt: e.target.value }))}
                        />
                        <Input
                          type="datetime-local"
                          value={bookingForm.endsAt}
                          onChange={(e: any) => setBookingForm((current) => ({ ...current, endsAt: e.target.value }))}
                        />
                        <Input
                          placeholder="Title"
                          value={bookingForm.title}
                          onChange={(e: any) => setBookingForm((current) => ({ ...current, title: e.target.value }))}
                        />
                        <Input
                          placeholder="Meeting link"
                          value={bookingForm.meetingLink}
                          onChange={(e: any) => setBookingForm((current) => ({ ...current, meetingLink: e.target.value }))}
                        />
                        <Textarea
                          placeholder="Booking notes"
                          value={bookingForm.description}
                          onChange={(e: any) => setBookingForm((current) => ({ ...current, description: e.target.value }))}
                        />
                        <select
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          value={bookingForm.status}
                          onChange={(e: any) =>
                            setBookingForm((current) => ({ ...current, status: e.target.value as OutreachBookingStatus }))
                          }
                        >
                          <option value="tentative">Tentative</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="rescheduled">Rescheduled</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        <Button type="submit" disabled={saving}>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Book call
                        </Button>
                      </form>
                    </div>

                    <div className="space-y-2 rounded-xl border border-border bg-base/80 p-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                        <Clock3 className="h-4 w-4" />
                        Reminder
                      </div>
                      <form className="space-y-2" onSubmit={createReminder}>
                        <Input
                          type="datetime-local"
                          value={reminderForm.reminderAt}
                          onChange={(e: any) => setReminderForm((current) => ({ ...current, reminderAt: e.target.value }))}
                        />
                        <select
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          value={reminderForm.channel}
                          onChange={(e: any) => setReminderForm((current) => ({ ...current, channel: e.target.value as OutreachChannel }))}
                        >
                          <option value="email">Email</option>
                          <option value="whatsapp">WhatsApp</option>
                          <option value="sms">SMS</option>
                          <option value="phone">Phone</option>
                          <option value="telegram">Telegram</option>
                          <option value="linkedin">LinkedIn</option>
                          <option value="manual">Manual</option>
                        </select>
                        <Textarea
                          placeholder="Reminder message"
                          value={reminderForm.message}
                          onChange={(e: any) => setReminderForm((current) => ({ ...current, message: e.target.value }))}
                        />
                        <select
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          value={reminderForm.status}
                          onChange={(e: any) =>
                            setReminderForm((current) => ({ ...current, status: e.target.value as OutreachReminderStatus }))
                          }
                        >
                          <option value="scheduled">Scheduled</option>
                          <option value="sent">Sent</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        <Button type="submit" disabled={saving}>
                          <Clock3 className="mr-2 h-4 w-4" />
                          Save reminder
                        </Button>
                      </form>
                    </div>

                    <div className="space-y-2 rounded-xl border border-border bg-base/80 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                          <MessageSquare className="h-4 w-4" />
                          Activity
                        </div>
                        <Badge variant="default">{timelineForLead.length}</Badge>
                      </div>
                      <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                        {timelineForLead.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-text-muted">
                            No activity yet.
                          </div>
                        ) : (
                          timelineForLead.map((item) => (
                            <div key={item.id} className="rounded-xl border border-border bg-elevated/80 px-3 py-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium text-text-primary">{timelineLabel(item.kind)}</p>
                                <span className="text-[11px] text-text-muted">{formatDate(item.createdAt)}</span>
                              </div>
                              <p className="mt-1 text-xs text-text-secondary">{item.title}</p>
                              {item.detail ? <p className="mt-1 text-xs text-text-muted">{item.detail}</p> : null}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 rounded-xl border border-border bg-base/80 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                          <Send className="h-4 w-4" />
                          Messages
                        </div>
                        <Badge variant="default">{messagesForLead.length}</Badge>
                      </div>
                      <div className="space-y-2">
                        {messagesForLead.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-text-muted">
                            No messages yet.
                          </div>
                        ) : (
                          messagesForLead.map((message) => (
                            <div key={message.id} className="rounded-xl border border-border bg-elevated/80 px-3 py-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium text-text-primary">{message.subject || 'Message'}</p>
                                <Badge variant={messageStatusClass(message.status).includes('rose') ? 'error' : message.status === 'sent' || message.status === 'delivered' ? 'active' : message.status === 'replied' ? 'paused' : 'default'}>
                                  {MESSAGE_STATUS_LABELS[message.status]}
                                </Badge>
                              </div>
                              <p className="mt-1 text-xs text-text-muted">{message.body}</p>
                              <div className="mt-2 text-[11px] text-text-muted">
                                {message.channel} {message.direction} {formatDate(message.sentAt ?? message.receivedAt ?? message.createdAt)}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <InfoList title="Bookings" count={bookingsForLead.length}>
                        {bookingsForLead.length === 0 ? (
                          <p className="text-sm text-text-muted">No bookings yet.</p>
                        ) : (
                          bookingsForLead.map((booking) => (
                            <div key={booking.id} className="rounded-xl border border-border bg-base/80 px-3 py-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium text-text-primary">{formatDate(booking.startsAt)}</p>
                                <Badge variant={booking.status === 'confirmed' ? 'active' : booking.status === 'cancelled' ? 'error' : 'paused'}>
                                  {BOOKING_STATUS_LABELS[booking.status]}
                                </Badge>
                              </div>
                              {booking.meetingLink ? <p className="mt-1 break-all text-xs text-text-muted">{booking.meetingLink}</p> : null}
                            </div>
                          ))
                        )}
                      </InfoList>
                      <InfoList title="Reminders" count={remindersForLead.length}>
                        {remindersForLead.length === 0 ? (
                          <p className="text-sm text-text-muted">No reminders yet.</p>
                        ) : (
                          remindersForLead.map((reminder) => (
                            <div key={reminder.id} className="rounded-xl border border-border bg-base/80 px-3 py-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium text-text-primary">{formatDate(reminder.reminderAt)}</p>
                                <Badge variant={reminder.status === 'sent' ? 'active' : reminder.status === 'cancelled' ? 'error' : 'paused'}>
                                  {REMINDER_STATUS_LABELS[reminder.status]}
                                </Badge>
                              </div>
                              <p className="mt-1 text-xs text-text-muted">{reminder.message}</p>
                            </div>
                          ))
                        )}
                      </InfoList>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title="No lead selected"
                    subtitle="Create a lead or choose one from the board to inspect the timeline."
                    icon={<UserPlus className="h-5 w-5" />}
                  />
                )}
              </section>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-base/80 px-3 py-3">
      <div className="text-xs text-text-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold text-text-primary">{value}</div>
    </div>
  );
}

function InfoList({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-border bg-base/80 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-text-primary">{title}</p>
        <Badge variant="default">{count}</Badge>
      </div>
      {children}
    </div>
  );
}
