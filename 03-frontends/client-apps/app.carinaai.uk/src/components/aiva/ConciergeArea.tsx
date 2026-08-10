'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import { ConciergeSetupTab } from '@/components/aiva/ConciergeSetupTab';

type ConciergePanel =
  | 'setup'
  | 'conversations'
  | 'support'
  | 'bookings'
  | 'knowledge'
  | 'channels'
  | 'integrations'
  | 'analytics';

const PANELS: Array<{ id: ConciergePanel; label: string }> = [
  { id: 'setup', label: 'Setup' },
  { id: 'conversations', label: 'Conversations' },
  { id: 'support', label: 'Support cases' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'channels', label: 'Channels' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'analytics', label: 'Analytics' },
];

type InboxRow = {
  audienceSessionId: string;
  channel: string;
  status: string;
  displayName: string | null;
  email: string | null;
  lastActiveAt: string;
  supportCaseId: string | null;
  supportCaseStatus: string | null;
  bookingId: string | null;
  bookingStatus: string | null;
  invitationDeliveryState: string | null;
  conferenceManaged: boolean | null;
  calendarEventId: string | null;
};

type BookingRow = {
  id: string;
  status: string;
  guestName: string;
  guestEmail: string;
  startsAt: string;
  invitationUiLabel?: string;
  invitationDeliveryState?: string;
  conferenceManaged: boolean | null;
  conferenceProvider: string | null;
  calendarEventId: string | null;
  meetingUrl: string | null;
  deepLinks?: { outreachBookings: string; vicalBookings: string };
};

type AnalyticsReport = {
  conversations: {
    started: number;
    closed: number;
    containmentRate: number | null;
    escalations: number;
  };
  support: {
    opened: number;
    resolved: number;
    medianFirstResponseMinutes: number | null;
    medianResolutionMinutes: number | null;
  };
  bookings: {
    confirmed: number;
    cancelled: number;
    conversionFromConversations: number | null;
    inviteSent: number;
    inviteAccepted: number;
    inviteFailed: number;
    noShow: number;
    attended: number;
  };
  providers: { errors: number; actionRequired: number };
  revenue: { attributedBookings: number; note: string };
  eventsSampled: number;
};

type TimelineBundle = {
  identity: {
    email: string | null;
    leadId: string | null;
    contactName: string | null;
    company: string | null;
  };
  enrollments: Array<{
    id: string;
    status: string;
    stopReason: string | null;
    sequenceName: string | null;
  }>;
  items: Array<{
    id: string;
    at: string;
    source: string;
    kind: string;
    title: string;
    summary: string;
  }>;
  leadTableFilters: Record<string, unknown>;
};

function Metric({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-text-muted">{label}</div>
      <div className="mt-0.5 text-lg font-semibold text-text-primary">
        {value == null ? ';' : value}
      </div>
    </div>
  );
}

export function ConciergeArea({ workerId }: { workerId: string }) {
  const [panel, setPanel] = useState<ConciergePanel>('setup');
  const [inbox, setInbox] = useState<InboxRow[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineBundle | null>(null);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [cases, setCases] = useState<Array<Record<string, unknown>>>([]);
  const [analytics, setAnalytics] = useState<AnalyticsReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumeBusy, setResumeBusy] = useState<string | null>(null);

  const loadPanel = useCallback(async () => {
    if (panel === 'setup' || panel === 'knowledge' || panel === 'channels' || panel === 'integrations') {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (panel === 'conversations') {
        const res = await fetch(`/api/aiva/workers/${workerId}/concierge/inbox`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Failed to load inbox');
        setInbox(data.conversations ?? []);
      } else if (panel === 'support') {
        const res = await fetch(`/api/aiva/workers/${workerId}/concierge/support-cases`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Failed to load cases');
        setCases(data.cases ?? []);
      } else if (panel === 'bookings') {
        const res = await fetch(`/api/aiva/workers/${workerId}/concierge/bookings`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Failed to load bookings');
        setBookings(data.bookings ?? []);
      } else if (panel === 'analytics') {
        const res = await fetch(`/api/aiva/workers/${workerId}/concierge/analytics`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Failed to load analytics');
        setAnalytics(data.analytics ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [panel, workerId]);

  useEffect(() => {
    void loadPanel();
  }, [loadPanel]);

  const openConversation = async (audienceSessionId: string, email: string | null) => {
    setSelectedSessionId(audienceSessionId);
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ audienceSessionId });
      if (email) qs.set('email', email);
      const res = await fetch(`/api/aiva/workers/${workerId}/concierge/crm-timeline?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load CRM timeline');
      setTimeline(data.timeline ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const resumeEnrollment = async (enrollmentId: string) => {
    setResumeBusy(enrollmentId);
    try {
      const res = await fetch(
        `/api/aiva/workers/${workerId}/concierge/outreach/enrollments/${enrollmentId}/resume`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Resume failed');
      if (selectedSessionId) {
        const row = inbox.find((r) => r.audienceSessionId === selectedSessionId);
        await openConversation(selectedSessionId, row?.email ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setResumeBusy(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-col gap-3 p-3 sm:p-4">
      <div className="flex flex-wrap gap-1.5 border-b border-border/70 pb-2">
        {PANELS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setPanel(p.id);
              setSelectedSessionId(null);
              setTimeline(null);
            }}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              panel === p.id
                ? 'bg-text-primary text-base'
                : 'bg-surface text-text-muted hover:text-text-primary',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {panel === 'setup' || panel === 'knowledge' || panel === 'channels' || panel === 'integrations' ? (
        <div className="min-h-0 flex-1">
          {(panel === 'knowledge' || panel === 'channels' || panel === 'integrations') && (
            <p className="mb-3 text-sm text-text-muted">
              {panel === 'knowledge'
                ? 'Publish and revise customer-facing knowledge in Setup (Knowledge section).'
                : panel === 'channels'
                  ? 'Enable widget and messaging channels in Setup. Conversations stay on the originating channel unless policy requires a change.'
                  : 'Connect calendar and Zoom in Setup (Integrations / Zoom).'}
            </p>
          )}
          <ConciergeSetupTab workerId={workerId} />
        </div>
      ) : null}

      {panel === 'conversations' ? (
        <div className="grid min-h-0 gap-3 lg:grid-cols-2">
          <div className="min-h-0 overflow-auto rounded-md border border-border/70">
            <div className="border-b border-border/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              Inbox
            </div>
            {loading && !inbox.length ? (
              <div className="flex justify-center p-6">
                <Spinner />
              </div>
            ) : inbox.length === 0 ? (
              <p className="p-3 text-sm text-text-muted">No audience conversations yet.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {inbox.map((row) => (
                  <li key={row.audienceSessionId}>
                    <button
                      type="button"
                      className={cn(
                        'w-full px-3 py-2.5 text-left hover:bg-surface',
                        selectedSessionId === row.audienceSessionId && 'bg-surface',
                      )}
                      onClick={() => void openConversation(row.audienceSessionId, row.email)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-text-primary">
                          {row.displayName || row.email || 'Visitor'}
                        </span>
                        <span className="shrink-0 text-[11px] text-text-muted">{row.channel}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-text-muted">
                        <span>{row.status}</span>
                        {row.bookingId ? <span>booking {row.bookingStatus}</span> : null}
                        {row.supportCaseId ? <span>case {row.supportCaseStatus}</span> : null}
                        {row.invitationDeliveryState ? <span>invite {row.invitationDeliveryState}</span> : null}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="min-h-0 overflow-auto rounded-md border border-border/70">
            <div className="border-b border-border/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              CRM timeline
            </div>
            {!timeline ? (
              <p className="p-3 text-sm text-text-muted">Select a conversation to follow contact, booking, calendar, and Zoom evidence.</p>
            ) : (
              <div className="space-y-3 p-3">
                <div className="text-sm">
                  <div className="font-medium text-text-primary">
                    {timeline.identity.contactName || timeline.identity.email || 'Contact'}
                  </div>
                  <div className="text-text-muted">
                    {[timeline.identity.email, timeline.identity.company, timeline.identity.leadId]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                  {timeline.identity.leadId ? (
                    <Link
                      href="/aiva/outreach/pipeline"
                      className="mt-1 inline-block text-xs text-text-primary underline"
                    >
                      Open pipeline / lead table
                    </Link>
                  ) : null}
                </div>
                {timeline.enrollments.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold uppercase text-text-muted">Outreach</div>
                    {timeline.enrollments.map((e) => (
                      <div key={e.id} className="flex items-center justify-between gap-2 text-xs">
                        <span>
                          {e.sequenceName ?? e.id} · {e.status}
                          {e.stopReason ? ` (${e.stopReason})` : ''}
                        </span>
                        {(e.status === 'paused' || e.stopReason === 'booking') && (
                          <button
                            type="button"
                            disabled={resumeBusy === e.id}
                            onClick={() => void resumeEnrollment(e.id)}
                            className="rounded border border-border px-2 py-0.5 hover:bg-surface"
                          >
                            {resumeBusy === e.id ? '…' : 'Resume'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
                <ol className="space-y-2">
                  {timeline.items.map((item) => (
                    <li key={item.id} className="border-l-2 border-border/80 pl-2">
                      <div className="text-[11px] text-text-muted">
                        {new Date(item.at).toLocaleString()} · {item.source}
                      </div>
                      <div className="text-sm font-medium text-text-primary">{item.title}</div>
                      <div className="text-xs text-text-muted">{item.summary}</div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {panel === 'support' ? (
        <div className="overflow-auto rounded-md border border-border/70">
          {loading ? (
            <div className="flex justify-center p-6">
              <Spinner />
            </div>
          ) : cases.length === 0 ? (
            <p className="p-3 text-sm text-text-muted">No support cases.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border/70 text-[11px] uppercase text-text-muted">
                <tr>
                  <th className="px-3 py-2">Subject</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Priority</th>
                  <th className="px-3 py-2">Opened</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {cases.map((c) => (
                  <tr key={String(c.id)}>
                    <td className="px-3 py-2">{String(c.subject ?? '')}</td>
                    <td className="px-3 py-2">{String(c.status ?? '')}</td>
                    <td className="px-3 py-2">{String(c.priority ?? '')}</td>
                    <td className="px-3 py-2 text-text-muted">
                      {c.createdAt ? new Date(String(c.createdAt)).toLocaleString() : ';'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}

      {panel === 'bookings' ? (
        <div className="space-y-3">
          <p className="text-sm text-text-muted">
            Same viCal booking ledger as{' '}
            <Link href="/aiva/outreach/bookings" className="underline">
              Outreach Bookings
            </Link>{' '}
            and{' '}
            <Link href="/vical/bookings" className="underline">
              viCal
            </Link>
            . Widget and messaging channels complete the same saga workflow.
          </p>
          <div className="overflow-auto rounded-md border border-border/70">
            {loading ? (
              <div className="flex justify-center p-6">
                <Spinner />
              </div>
            ) : bookings.length === 0 ? (
              <p className="p-3 text-sm text-text-muted">No bookings yet.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border/70 text-[11px] uppercase text-text-muted">
                  <tr>
                    <th className="px-3 py-2">Guest</th>
                    <th className="px-3 py-2">When</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Invite</th>
                    <th className="px-3 py-2">Conference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {bookings.map((b) => (
                    <tr key={b.id}>
                      <td className="px-3 py-2">
                        <div>{b.guestName}</div>
                        <div className="text-xs text-text-muted">{b.guestEmail}</div>
                      </td>
                      <td className="px-3 py-2 text-text-muted">
                        {new Date(b.startsAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">{b.status}</td>
                      <td className="px-3 py-2">{b.invitationUiLabel ?? b.invitationDeliveryState ?? ';'}</td>
                      <td className="px-3 py-2 text-xs text-text-muted">
                        {b.conferenceProvider
                          ? `${b.conferenceProvider}${b.conferenceManaged ? ' (managed)' : ''}`
                          : ';'}
                        {b.meetingUrl ? (
                          <div>
                            <a href={b.meetingUrl} className="underline" target="_blank" rel="noreferrer">
                              Join
                            </a>
                          </div>
                        ) : null}
                        {b.calendarEventId ? <div>cal {b.calendarEventId.slice(0, 12)}…</div> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : null}

      {panel === 'analytics' ? (
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            Metrics derive from durable concierge events and booking/support ledgers. Message content is redacted from aggregates.
          </p>
          {loading || !analytics ? (
            <div className="flex justify-center p-6">
              <Spinner />
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Conversations started" value={analytics.conversations.started} />
                <Metric
                  label="Containment rate"
                  value={
                    analytics.conversations.containmentRate == null
                      ? null
                      : `${Math.round(analytics.conversations.containmentRate * 100)}%`
                  }
                />
                <Metric label="Escalations" value={analytics.conversations.escalations} />
                <Metric
                  label="Booking conversion"
                  value={
                    analytics.bookings.conversionFromConversations == null
                      ? null
                      : `${Math.round(analytics.bookings.conversionFromConversations * 100)}%`
                  }
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Cases opened" value={analytics.support.opened} />
                <Metric label="Cases resolved" value={analytics.support.resolved} />
                <Metric
                  label="Median first response (min)"
                  value={
                    analytics.support.medianFirstResponseMinutes == null
                      ? null
                      : Math.round(analytics.support.medianFirstResponseMinutes)
                  }
                />
                <Metric
                  label="Median resolution (min)"
                  value={
                    analytics.support.medianResolutionMinutes == null
                      ? null
                      : Math.round(analytics.support.medianResolutionMinutes)
                  }
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Bookings confirmed" value={analytics.bookings.confirmed} />
                <Metric label="Cancelled" value={analytics.bookings.cancelled} />
                <Metric label="Invite sent / accepted" value={`${analytics.bookings.inviteSent} / ${analytics.bookings.inviteAccepted}`} />
                <Metric label="No-show / attended" value={`${analytics.bookings.noShow} / ${analytics.bookings.attended}`} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Metric label="Provider errors" value={analytics.providers.errors} />
                <Metric label="Action required" value={analytics.providers.actionRequired} />
                <Metric label="Attributed bookings" value={analytics.revenue.attributedBookings} />
              </div>
              <p className="text-xs text-text-muted">
                {analytics.revenue.note} Events sampled: {analytics.eventsSampled}.
              </p>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
