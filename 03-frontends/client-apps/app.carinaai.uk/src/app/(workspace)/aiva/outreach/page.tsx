'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import { searchCompaniesHouse, type CompanyProfile, type CompanySearchHit } from '@/lib/companies-house-api';
import { PIPELINE_LABELS, type PipelineStatus } from '@/components/outreach/types';

type Overview = {
  summary: Record<string, number>;
  pendingApprovals: number;
  activeEnrollments: number;
  openReplyReviews?: number;
  upcomingBookings?: number;
  scheduledReminders?: number;
  defaults: {
    campaign: { id: string; name: string };
    sequence: { id: string; name: string; steps: unknown[] };
  };
};

type ControlState = {
  workspaceId: string;
  paused: boolean;
  reason?: string;
  updatedBy?: string;
  updatedAt: string;
};

type BoardConfig = {
  config: {
    workspaceId: string;
    backend: 'trello' | 'native';
    enabled: boolean;
    trelloBoardId?: string;
    nativeSessionId?: string;
    nativeBoardId?: string;
    lastGrantWarning?: string;
    lastSyncedAt?: string;
  } | null;
  summary?: {
    enabled?: boolean;
    backend?: string;
    stageCounts?: Record<string, number>;
  };
};

type AlertTarget = {
  target: {
    enabled: boolean;
    channel?: string;
    conversationId?: string;
    workerId?: string;
    label?: string;
  } | null;
};

type LeadItem = {
  id: string;
  name: string;
  company?: string;
  email?: string;
  status: string;
  replyState?: string;
  bookingState?: string;
};

type SequenceItem = {
  id: string;
  name: string;
  steps: Array<{ id: string; order: number; label: string }>;
};

type EmailApproval = {
  id: string;
  recipient: string;
  subject: string;
  draftBody: string;
  status: string;
  category?: string;
  workerName?: string;
  requestedAt: string;
};

const QUICK_LINKS = [
  { href: '/aiva/outreach/leads', label: 'Leads', description: 'Import, edit, and route leads.' },
  { href: '/aiva/outreach/pipeline', label: 'Pipeline', description: 'See the live board by status.' },
  { href: '/aiva/outreach/replies', label: 'Replies', description: 'Review inbound replies.' },
  { href: '/aiva/outreach/bookings', label: 'Bookings', description: 'Schedule, reschedule, and confirm.' },
  { href: '/aiva/outreach/lists', label: 'Lists', description: 'Organize audiences and membership.' },
  { href: '/aiva/outreach/campaigns', label: 'Campaigns', description: 'Control cadence and approvals.' },
  { href: '/aiva/outreach/sequences', label: 'Sequences', description: 'Edit message steps and stop rules.' },
  { href: '/aiva/outreach/companies-house', label: 'Companies House', description: 'Turn registry profiles into leads.' },
  { href: '/aiva/outreach/channels', label: 'Channels', description: 'Content and delivery entry points.' },
  { href: '/aiva/approvals', label: 'Approvals', description: 'Approve pending sends.' },
] as const;

export default function OutreachOverviewPage() {
  const { push } = useToast();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [control, setControl] = useState<ControlState | null>(null);
  const [board, setBoard] = useState<BoardConfig | null>(null);
  const [alertTarget, setAlertTarget] = useState<AlertTarget | null>(null);
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [sequences, setSequences] = useState<SequenceItem[]>([]);
  const [campaignName, setCampaignName] = useState('');
  const [campaignObjective, setCampaignObjective] = useState('');
  const [leadImportText, setLeadImportText] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [selectedSequenceId, setSelectedSequenceId] = useState('');
  const [companiesHouseQuery, setCompaniesHouseQuery] = useState('');
  const [companyHits, setCompanyHits] = useState<CompanySearchHit[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<CompanyProfile | null>(null);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [replyReviews, setReplyReviews] = useState<Array<{ id: string; fromEmail: string; subject: string; bodyPreview: string; classification: string; confidence: number; status: string; suggestedReply?: string }>>([]);
  const [pendingApprovals, setPendingApprovals] = useState<EmailApproval[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/aiva/outreach/overview').then((res) => (res.ok ? res.json() : null)),
      fetch('/api/aiva/outreach/control').then((res) => (res.ok ? res.json() : null)),
      fetch('/api/aiva/outreach/board-config').then((res) => (res.ok ? res.json() : null)),
      fetch('/api/aiva/outreach/alert-target').then((res) => (res.ok ? res.json() : null)),
      fetch('/api/aiva/outreach/leads').then((res) => (res.ok ? res.json() : { leads: [] })),
      fetch('/api/aiva/outreach/sequences').then((res) => (res.ok ? res.json() : { sequences: [] })),
      fetch('/api/aiva/outreach/replies/review?status=open').then((res) => (res.ok ? res.json() : { reviews: [] })),
      fetch('/api/aiva/email/approvals/inbox').then((res) => (res.ok ? res.json() : { approvals: [] })),
    ])
      .then(([overviewJson, controlJson, boardJson, alertJson, leadJson, seqJson, replyJson, approvalJson]) => {
        setOverview(overviewJson);
        setControl(controlJson?.state ?? null);
        setBoard(boardJson);
        setAlertTarget(alertJson);
        setLeads(leadJson?.leads ?? []);
        setSequences(seqJson?.sequences ?? []);
        setReplyReviews(replyJson?.reviews ?? []);
        setPendingApprovals(approvalJson?.approvals ?? []);
        if (!selectedLeadId && (leadJson?.leads ?? []).length > 0) {
          setSelectedLeadId(leadJson.leads[0].id);
        }
        if (!selectedSequenceId && (seqJson?.sequences ?? []).length > 0) {
          setSelectedSequenceId(seqJson.sequences[0].id);
        }
      })
      .catch(() => {
        setOverview(null);
        setControl(null);
        setBoard(null);
        setAlertTarget(null);
        setLeads([]);
        setSequences([]);
        setReplyReviews([]);
        setPendingApprovals([]);
      })
      .finally(() => setLoading(false));
  }, [selectedLeadId, selectedSequenceId]);

  useEffect(() => {
    load();
  }, [load]);

  const processDue = useCallback(async () => {
    const res = await fetch('/api/aiva/outreach/process-due', { method: 'POST' });
    if (!res.ok) {
      push('Could not process due sequence steps', 'error');
      return;
    }
    const json = await res.json();
    push(
      `Queued ${json.processed?.length ?? 0} Soft Wall draft(s); skipped ${json.skipped?.length ?? 0}`,
      'success',
    );
    load();
  }, [push, load]);

  const togglePause = useCallback(async () => {
    const nextAction = control?.paused ? 'resume' : 'pause';
    const res = await fetch('/api/aiva/outreach/control', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: nextAction,
        reason: nextAction === 'pause' ? 'Operator pause from control center' : undefined,
      }),
    });
    if (!res.ok) {
      push('Could not update outreach control state', 'error');
      return;
    }
    push(nextAction === 'pause' ? 'Outreach paused' : 'Outreach resumed', 'success');
    load();
  }, [control?.paused, load, push]);

  const createCampaign = useCallback(async () => {
    if (!campaignName.trim()) {
      push('Campaign name is required', 'error');
      return;
    }
    const res = await fetch('/api/aiva/outreach/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: campaignName, objective: campaignObjective }),
    });
    if (!res.ok) {
      push('Could not create campaign', 'error');
      return;
    }
    setCampaignName('');
    setCampaignObjective('');
    push('Campaign created', 'success');
    load();
  }, [campaignName, campaignObjective, load, push]);

  const importLeads = useCallback(async () => {
    const rows = leadImportText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, email, company, phone] = line.split('|').map((item) => item.trim());
        return { name, email, company, phone, source: 'manual' };
      })
      .filter((row) => row.name);
    if (!rows.length) {
      push('Add at least one lead line', 'error');
      return;
    }
    const res = await fetch('/api/aiva/outreach/leads/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leads: rows }),
    });
    if (!res.ok) {
      push('Could not import leads', 'error');
      return;
    }
    setLeadImportText('');
    push('Leads imported', 'success');
    load();
  }, [leadImportText, load, push]);

  const enrollSequence = useCallback(async () => {
    if (!selectedLeadId || !selectedSequenceId) {
      push('Choose a lead and a sequence', 'error');
      return;
    }
    const res = await fetch('/api/aiva/outreach/enrollments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId: selectedLeadId, sequenceId: selectedSequenceId }),
    });
    if (!res.ok) {
      push('Could not enroll sequence', 'error');
      return;
    }
    push('Lead enrolled in sequence', 'success');
    load();
  }, [load, push, selectedLeadId, selectedSequenceId]);

  const resolveReply = useCallback(async (reviewId: string, classification: string) => {
    const res = await fetch(`/api/aiva/outreach/replies/${reviewId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classification }),
    });
    if (!res.ok) {
      push('Could not resolve reply', 'error');
      return;
    }
    push('Reply resolved', 'success');
    load();
  }, [load, push]);

  const approvePending = useCallback(async (approvalId: string) => {
    const res = await fetch(`/api/aiva/email/approvals/${approvalId}/approve`, { method: 'POST' });
    if (!res.ok) {
      push('Could not approve send', 'error');
      return;
    }
    push('Send approved', 'success');
    load();
  }, [load, push]);

  const rejectPending = useCallback(async (approvalId: string) => {
    const res = await fetch(`/api/aiva/email/approvals/${approvalId}/reject`, { method: 'POST' });
    if (!res.ok) {
      push('Could not reject send', 'error');
      return;
    }
    push('Send rejected', 'success');
    load();
  }, [load, push]);

  const searchCompaniesHouseNow = useCallback(async () => {
    if (!companiesHouseQuery.trim()) {
      push('Enter a company name or number', 'error');
      return;
    }
    setCompanyLoading(true);
    try {
      const result = await searchCompaniesHouse(companiesHouseQuery.trim(), { items_per_page: 6 });
      const items = result.items ?? [];
      setCompanyHits(items);
      if (items[0]?.company_number) {
        const profile = await fetch(`/api/companies-house/company/${encodeURIComponent(items[0].company_number)}`).then((res) => res.ok ? res.json() : null);
        setSelectedCompany(profile);
      }
    } finally {
      setCompanyLoading(false);
    }
  }, [companiesHouseQuery, push]);

  const importSelectedCompany = useCallback(async (company: CompanyProfile | null) => {
    if (!company) return;
    const res = await fetch('/api/aiva/outreach/companies-house/import-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyNumber: company.company_number,
        companyName: company.company_name || company.company_number,
        companyStatus: company.company_status,
        registeredOffice: company.registered_office_address?.formatted,
        sicCodes: company.sic_codes ?? [],
        officerNames: (company.officers ?? []).map((officer) => officer.name).filter(Boolean),
        tags: ['companies_house'],
      }),
    });
    if (!res.ok) {
      push('Could not import company', 'error');
      return;
    }
    push('Company imported as lead', 'success');
    load();
  }, [load, push]);

  const statusKeys = useMemo(() => Object.keys(PIPELINE_LABELS) as PipelineStatus[], []);

  if (loading) {
    return <div className="p-6 text-sm text-text-muted">Loading outreach...</div>;
  }

  if (!overview || !control) {
    return <div className="p-6 text-sm text-text-muted">Could not load sales engagement.</div>;
  }

  return (
    <div className="mx-auto max-w-[90rem] space-y-6 p-6">
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-text-muted">Outreach control center</p>
              <h1 className="text-2xl font-semibold text-text-primary">Sales engagement</h1>
            </div>
            <p className="max-w-3xl text-sm text-text-secondary">
              Manage lead intake, campaign pacing, sequences, approvals, replies, bookings, and registry ingest from one surface.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ${
                  control.paused
                    ? 'bg-amber-500/15 text-amber-300'
                    : 'bg-emerald-500/15 text-emerald-400'
                }`}
              >
                {control.paused ? 'Paused' : 'Active'}
              </span>
              {control.reason ? (
                <span className="text-xs text-text-muted">{control.reason}</span>
              ) : null}
              {control.updatedAt ? (
                <span className="text-xs text-text-muted">Updated {new Date(control.updatedAt).toLocaleString()}</span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void processDue()}>
              Process due sends
            </Button>
            <Button size="sm" variant="outline" onClick={() => void togglePause()}>
              {control.paused ? 'Resume outreach' : 'Pause outreach'}
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/aiva/approvals">Open Approvals</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total leads" value={overview.summary.total ?? 0} />
        <Stat label="Active enrollments" value={overview.activeEnrollments} />
        <Stat label="Pending Soft Wall" value={overview.pendingApprovals} />
        <Stat label="Booked" value={overview.summary.booked ?? 0} />
        <Stat label="Open reply reviews" value={overview.openReplyReviews ?? 0} />
        <Stat label="Upcoming bookings" value={overview.upcomingBookings ?? 0} />
        <Stat label="Scheduled reminders" value={overview.scheduledReminders ?? 0} />
        <Stat label="Follow-up" value={overview.summary.follow_up ?? 0} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-text-primary">Import leads</h2>
              <p className="mt-1 text-xs text-text-muted">One lead per line: name | email | company | phone</p>
            </div>
            <Button size="sm" onClick={() => void importLeads()}>Import</Button>
          </div>
          <textarea
            className="mt-3 min-h-32 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary"
            value={leadImportText}
            onChange={(e) => setLeadImportText(e.target.value)}
            placeholder="Jane Doe | jane@example.com | Example Ltd | +44..."
          />
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-text-primary">Create campaign</h2>
              <p className="mt-1 text-xs text-text-muted">Build a new campaign from the home screen.</p>
            </div>
            <Button size="sm" onClick={() => void createCampaign()}>Create</Button>
          </div>
          <div className="mt-3 grid gap-2">
            <input className="rounded-md border border-border bg-surface px-3 py-2 text-sm" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Campaign name" />
            <input className="rounded-md border border-border bg-surface px-3 py-2 text-sm" value={campaignObjective} onChange={(e) => setCampaignObjective(e.target.value)} placeholder="Objective" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-text-primary">Enroll a sequence</h2>
              <p className="mt-1 text-xs text-text-muted">Pick a lead and a sequence, then enroll directly.</p>
            </div>
            <Button size="sm" onClick={() => void enrollSequence()}>Enroll</Button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <select className="rounded-md border border-border bg-surface px-3 py-2 text-sm" value={selectedLeadId} onChange={(e) => setSelectedLeadId(e.target.value)}>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>{lead.name}{lead.company ? ` - ${lead.company}` : ''}</option>
              ))}
            </select>
            <select className="rounded-md border border-border bg-surface px-3 py-2 text-sm" value={selectedSequenceId} onChange={(e) => setSelectedSequenceId(e.target.value)}>
              {sequences.map((sequence) => (
                <option key={sequence.id} value={sequence.id}>{sequence.name}</option>
              ))}
            </select>
          </div>
          <div className="mt-3 text-xs text-text-muted">
            {leads.length} leads loaded, {sequences.length} sequences loaded
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-text-primary">Companies House ingest</h2>
              <p className="mt-1 text-xs text-text-muted">Search, inspect, and import a public company as a lead.</p>
            </div>
            <Button size="sm" onClick={() => void searchCompaniesHouseNow()}>{companyLoading ? 'Searching...' : 'Search'}</Button>
          </div>
          <div className="mt-3 space-y-3">
            <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={companiesHouseQuery} onChange={(e) => setCompaniesHouseQuery(e.target.value)} placeholder="Company name or number" />
            <div className="grid gap-2">
              {companyHits.slice(0, 3).map((hit) => (
                <button key={hit.company_number} type="button" className="rounded-lg border border-border bg-surface px-3 py-2 text-left" onClick={async () => {
                  const profile = await fetch(`/api/companies-house/company/${encodeURIComponent(hit.company_number)}`).then((res) => res.ok ? res.json() : null);
                  setSelectedCompany(profile);
                }}>
                  <p className="text-sm font-medium text-text-primary">{hit.title || hit.company_number}</p>
                  <p className="text-xs text-text-muted">{hit.company_number}{hit.address_snippet ? ` - ${hit.address_snippet}` : ''}</p>
                </button>
              ))}
            </div>
            {selectedCompany ? (
              <div className="rounded-lg border border-border bg-surface p-3">
                <p className="text-sm font-medium text-text-primary">{selectedCompany.company_name || selectedCompany.company_number}</p>
                <p className="mt-1 text-xs text-text-muted">{selectedCompany.company_status || 'unknown'}{selectedCompany.registered_office_address?.formatted ? ` - ${selectedCompany.registered_office_address.formatted}` : ''}</p>
                <Button size="sm" className="mt-3" onClick={() => void importSelectedCompany(selectedCompany)}>
                  Add as lead
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-sm font-medium text-text-primary">Pipeline snapshot</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {statusKeys.map((key) => (
                <div key={key} className="rounded-lg border border-border bg-surface px-3 py-2">
                  <p className="text-xs text-text-muted">{PIPELINE_LABELS[key]}</p>
                  <p className="text-lg font-semibold text-text-primary">{overview.summary[key] ?? 0}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-medium text-text-primary">Operational defaults</h2>
                <p className="mt-1 text-xs text-text-muted">
                  Default campaign and sequence that seeds new work.
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link href="/aiva/outreach/campaigns">Edit campaigns</Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/aiva/outreach/sequences">Edit sequences</Link>
                </Button>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <MiniField label="Default campaign" value={overview.defaults.campaign.name} />
              <MiniField label="Default sequence" value={overview.defaults.sequence.name} />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-sm font-medium text-text-primary">Board and alert routing</h2>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <MiniField
                label="Board backend"
                value={board?.config ? `${board.config.backend}${board.config.enabled ? ' enabled' : ' disabled'}` : 'Not set'}
              />
              <MiniField
                label="Alert target"
                value={alertTarget?.target?.label || alertTarget?.target?.channel || 'Not set'}
              />
              <MiniField
                label="Board sync"
                value={board?.config?.lastSyncedAt ? new Date(board.config.lastSyncedAt).toLocaleString() : 'Never'}
              />
              <MiniField
                label="Alert channel"
                value={alertTarget?.target?.channel || 'Not set'}
              />
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-medium text-text-primary">Open replies</h2>
                <p className="mt-1 text-xs text-text-muted">Review inbound reply classification without leaving home.</p>
              </div>
              <Button size="sm" variant="outline" asChild>
                <Link href="/aiva/outreach/replies">Full inbox</Link>
              </Button>
            </div>
            <div className="mt-3 space-y-2">
              {replyReviews.slice(0, 3).map((review) => (
                <div key={review.id} className="rounded-lg border border-border bg-surface p-3">
                  <p className="text-sm font-medium text-text-primary">{review.fromEmail}</p>
                  <p className="mt-1 text-xs text-text-muted">{review.subject}</p>
                  <p className="mt-2 text-sm text-text-secondary">{review.bodyPreview}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => void resolveReply(review.id, review.classification)}>
                      Keep {review.classification}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void resolveReply(review.id, 'unknown')}>
                      Open
                    </Button>
                  </div>
                </div>
              ))}
              {replyReviews.length === 0 ? <p className="text-xs text-text-muted">No open replies.</p> : null}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-medium text-text-primary">Pending approvals</h2>
                <p className="mt-1 text-xs text-text-muted">Approve or reject outbound sends here.</p>
              </div>
              <Button size="sm" variant="outline" asChild>
                <Link href="/aiva/approvals">Full inbox</Link>
              </Button>
            </div>
            <div className="mt-3 space-y-2">
              {pendingApprovals.slice(0, 3).map((approval) => (
                <div key={approval.id} className="rounded-lg border border-border bg-surface p-3">
                  <p className="text-sm font-medium text-text-primary">{approval.recipient}</p>
                  <p className="mt-1 text-xs text-text-muted">{approval.subject}</p>
                  <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-text-secondary">{approval.draftBody}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => void approvePending(approval.id)}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => void rejectPending(approval.id)}>Reject</Button>
                  </div>
                </div>
              ))}
              {pendingApprovals.length === 0 ? <p className="text-xs text-text-muted">No pending approvals.</p> : null}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-sm font-medium text-text-primary">Quick actions</h2>
            <div className="mt-3 grid gap-2">
              {QUICK_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg border border-border bg-surface px-3 py-2 transition-colors hover:bg-elevated"
                >
                  <p className="text-sm font-medium text-text-primary">{item.label}</p>
                  <p className="mt-0.5 text-xs text-text-muted">{item.description}</p>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 text-sm text-text-secondary">
            <p className="font-medium text-text-primary">How this works</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Import or add leads, then route them into campaigns and lists.</li>
              <li>Enroll leads into sequences, then queue due steps through the Soft Wall.</li>
              <li>Review replies, bookings, and approvals from the same workspace.</li>
              <li>Use Companies House to turn public records into leads when needed.</li>
            </ol>
          </div>
        </aside>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function MiniField({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-sm font-medium text-text-primary">{value ?? 'Not set'}</p>
    </div>
  );
}
