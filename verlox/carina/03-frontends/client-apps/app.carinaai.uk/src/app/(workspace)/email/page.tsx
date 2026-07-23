'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Loader2,
  Mail,
  PenSquare,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { CoreSurfaceBanner } from '@/components/shell/CoreSurfaceBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { OriginBadge } from '@/components/ui/OriginBadge';
import { OriginFilterChips } from '@/components/ui/OriginFilterChips';
import { Spinner } from '@/components/ui/Spinner';
import { CarinaEditor } from '@/components/editor';
import {
  EMAIL_ORIGIN_HELPER_TEXT,
  classifyEmailOrigin,
  matchesOriginFilter,
  type OriginFilter,
} from '@/lib/sync-ownership';
import { cn } from '@/lib/utils';

type FilterTab = 'inbox' | 'sent' | 'high' | 'draft_reply' | 'archived' | 'spam';

interface EmailRow {
  id: string;
  fromAddress: string;
  toAddress?: string | null;
  source?: string | null;
  subject: string;
  bodyPreview: string | null;
  bodyFull: string | null;
  urgency: string;
  status: string;
  aiDraftReply: string | null;
  receivedAt: string;
  externalId?: string | null;
}

const EMAIL_SYNC_STORAGE_KEY = 'aiva.email.lastSyncedAt';

const TABS: Array<{ id: FilterTab; label: string; status?: string; urgency?: string }> = [
  { id: 'inbox', label: 'Inbox', status: 'inbox' },
  { id: 'sent', label: 'Sent', status: 'sent' },
  { id: 'high', label: 'High urgency', urgency: 'high' },
  { id: 'draft_reply', label: 'Drafts', status: 'draft_reply' },
  { id: 'archived', label: 'Archived', status: 'archived' },
  { id: 'spam', label: 'Spam', status: 'spam' },
];

const SOURCE_OPTIONS = [
  { id: '', label: 'Any source' },
  { id: 'aiva', label: 'Aiva' },
  { id: 'google', label: 'Google' },
  { id: 'local', label: 'Local' },
] as const;

function urgencyClass(urgency: string): string {
  if (urgency === 'high') return 'bg-danger/20 text-danger';
  if (urgency === 'low') return 'bg-text-muted/20 text-text-muted';
  return 'bg-accent-dim text-accent';
}

export default function EmailPage() {
  const [tab, setTab] = useState<FilterTab>('inbox');
  const [rows, setRows] = useState<EmailRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [drafting, setDrafting] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [originFilter, setOriginFilter] = useState<OriginFilter>('all');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [sending, setSending] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');
  const [appliedSource, setAppliedSource] = useState('');
  const [appliedDateFrom, setAppliedDateFrom] = useState('');
  const [appliedDateTo, setAppliedDateTo] = useState('');
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [approvalNotice, setApprovalNotice] = useState<string | null>(null);

  const filteredRows = useMemo(
    () =>
      rows.filter((row) =>
        matchesOriginFilter({ origin: classifyEmailOrigin(row) }, originFilter),
      ),
    [rows, originFilter],
  );

  const selected = filteredRows.find((row) => row.id === selectedId) ?? null;
  const isSentView = tab === 'sent' || selected?.status === 'sent';

  async function load() {
    setLoading(true);
    const active = TABS.find((t) => t.id === tab)!;
    const params = new URLSearchParams({ meta: '1', limit: '100' });
    if (active.status) params.set('status', active.status);
    if (active.urgency) params.set('urgency', active.urgency);
    if (appliedQ) params.set('q', appliedQ);
    if (appliedFrom) params.set('from', appliedFrom);
    if (appliedTo) params.set('to', appliedTo);
    if (appliedSource) params.set('source', appliedSource);
    if (appliedDateFrom) params.set('dateFrom', appliedDateFrom);
    if (appliedDateTo) params.set('dateTo', appliedDateTo);

    const res = await fetch(`/api/email?${params}`);
    const data = await res.json();
    if (data.data) {
      setRows(data.data);
      if (!selectedId && data.data[0]) setSelectedId(data.data[0].id);
      else if (selectedId && !data.data.some((r: EmailRow) => r.id === selectedId)) {
        setSelectedId(data.data[0]?.id ?? null);
      }
    }
    if (data.meta?.inboundWebhookUrl) setWebhookUrl(data.meta.inboundWebhookUrl);
    setLoading(false);
  }

  useEffect(() => {
    try {
      setLastSyncedAt(localStorage.getItem(EMAIL_SYNC_STORAGE_KEY));
    } catch {
      setLastSyncedAt(null);
    }
    void load();
  }, [tab, appliedQ, appliedFrom, appliedTo, appliedSource, appliedDateFrom, appliedDateTo]);

  useEffect(() => {
    setDraftText(selected?.aiDraftReply ?? '');
    setApprovalNotice(null);
  }, [selected?.id, selected?.aiDraftReply]);

  function applyFilters() {
    setAppliedQ(searchQ.trim());
    setAppliedFrom(filterFrom.trim());
    setAppliedTo(filterTo.trim());
    setAppliedSource(filterSource.trim());
    setAppliedDateFrom(dateFrom.trim());
    setAppliedDateTo(dateTo.trim());
  }

  function clearFilters() {
    setSearchQ('');
    setFilterFrom('');
    setFilterTo('');
    setFilterSource('');
    setDateFrom('');
    setDateTo('');
    setAppliedQ('');
    setAppliedFrom('');
    setAppliedTo('');
    setAppliedSource('');
    setAppliedDateFrom('');
    setAppliedDateTo('');
  }

  async function syncNow() {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch('/api/email/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 15 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSyncError(typeof data.error === 'string' ? data.error : 'Sync failed');
        return;
      }
      const stamp =
        typeof data.syncedAt === 'string' ? data.syncedAt : new Date().toISOString();
      try {
        localStorage.setItem(EMAIL_SYNC_STORAGE_KEY, stamp);
      } catch {
        /* ignore */
      }
      setLastSyncedAt(stamp);
      const inboxImported = Number(data.folders?.inbox?.imported ?? 0);
      const inboxUpdated = Number(data.folders?.inbox?.updated ?? 0);
      if (inboxImported + inboxUpdated > 0 && tab !== 'inbox') {
        setTab('inbox');
      } else {
        await load();
      }
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  async function sendCompose() {
    setSending(true);
    setComposeError(null);
    try {
      const res = await fetch('/api/email/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: composeTo.trim(),
          subject: composeSubject.trim(),
          body: composeBody,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setComposeError(typeof data.error === 'string' ? data.error : 'Send failed');
        return;
      }
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      setComposeOpen(false);
      const newId = typeof data.id === 'string' ? data.id : null;
      setSelectedId(newId);
      if (tab === 'sent') await load();
      else setTab('sent');
    } catch (err) {
      setComposeError(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setSending(false);
    }
  }

  async function generateDraft() {
    if (!selected) return;
    setDrafting(true);
    const res = await fetch(`/api/email/${selected.id}/draft`, { method: 'POST' });
    const data = await res.json();
    setDrafting(false);
    if (!res.ok) {
      alert(data.error || 'Draft failed');
      return;
    }
    setDraftText(data.data?.draft ?? '');
    await load();
  }

  async function saveDraft() {
    if (!selected) return;
    await fetch(`/api/email/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aiDraftReply: draftText }),
    });
    await load();
  }

  async function submitForApproval() {
    if (!selected) return;
    const body = draftText.trim();
    if (!body) {
      setApprovalNotice('Write or generate a draft before submitting for approval.');
      return;
    }
    setSubmittingApproval(true);
    setApprovalNotice(null);
    try {
      await fetch(`/api/email/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiDraftReply: body }),
      });
      const res = await fetch(`/api/email/${selected.id}/submit-approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftBody: body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setApprovalNotice(typeof data.error === 'string' ? data.error : 'Could not queue approval');
        return;
      }
      setApprovalNotice('Queued for approval. Review and send from Approvals.');
      await load();
    } catch (err) {
      setApprovalNotice(err instanceof Error ? err.message : 'Could not queue approval');
    } finally {
      setSubmittingApproval(false);
    }
  }

  async function archiveMessage() {
    if (!selected) return;
    await fetch(`/api/email/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'archived' }),
    });
    await load();
  }

  async function markSpam() {
    if (!selected) return;
    await fetch(`/api/email/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'spam', urgency: 'spam' }),
    });
    await load();
  }

  const hasActiveFilters = Boolean(
    appliedQ || appliedFrom || appliedTo || appliedSource || appliedDateFrom || appliedDateTo,
  );

  return (
    <div className="flex h-full min-w-0 flex-col overflow-x-hidden">
      <header className="flex min-w-0 flex-col gap-3 border-b border-border px-3 py-4 sm:px-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-text-primary">Email</h1>
          <p className="text-xs text-text-muted">{EMAIL_ORIGIN_HELPER_TEXT}</p>
          <p className="mt-0.5 text-xs text-text-muted">
            Sync pulls Gmail Inbox and Sent. Aivas can read synced mail and draft replies; send only
            after you approve in{' '}
            <a href="/aiva/approvals" className="text-accent hover:underline">
              Approvals
            </a>
            .
          </p>
          {lastSyncedAt ? (
            <p className="mt-0.5 text-[10px] text-text-muted">
              Last synced {new Date(lastSyncedAt).toLocaleString()}
            </p>
          ) : null}
          {syncError ? (
            <p className="mt-0.5 text-[10px] text-danger">{syncError}</p>
          ) : null}
        </div>
        <div className="grid w-full grid-cols-2 items-center gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
          <button
            type="button"
            onClick={() => {
              setComposeOpen(true);
              setComposeError(null);
            }}
            className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-md bg-accent px-2.5 py-1.5 text-xs text-primary-foreground hover:opacity-90"
          >
            <PenSquare className="h-3.5 w-3.5" />
            Compose
          </button>
          <button
            type="button"
            onClick={() => void syncNow()}
            className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-text-secondary hover:bg-elevated"
          >
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Sync now
          </button>
          <IconButton label="Refresh" onClick={load}>
            <RefreshCw className="h-4 w-4" />
          </IconButton>
        </div>
      </header>

      <div className="min-w-0 space-y-2 border-b border-border px-3 py-2 sm:px-6">
        <OriginFilterChips value={originFilter} onChange={setOriginFilter} />
        <div className="grid gap-2 md:grid-cols-6">
          <label className="block text-[10px] text-text-muted md:col-span-2">
            Search
            <input
              type="search"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyFilters();
              }}
              className="mt-0.5 w-full rounded-md border border-border bg-elevated px-2 py-1.5 text-xs text-text-primary"
              placeholder="Subject, body, from, to"
            />
          </label>
          <label className="block text-[10px] text-text-muted">
            From
            <input
              type="text"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="mt-0.5 w-full rounded-md border border-border bg-elevated px-2 py-1.5 text-xs text-text-primary"
              placeholder="sender@"
            />
          </label>
          <label className="block text-[10px] text-text-muted">
            To
            <input
              type="text"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="mt-0.5 w-full rounded-md border border-border bg-elevated px-2 py-1.5 text-xs text-text-primary"
              placeholder="recipient@"
            />
          </label>
          <label className="block text-[10px] text-text-muted">
            Source
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="mt-0.5 w-full rounded-md border border-border bg-elevated px-2 py-1.5 text-xs text-text-primary"
            >
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.id || 'any'} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 items-end gap-1 md:flex">
            <button
              type="button"
              onClick={applyFilters}
              className="rounded-md bg-accent px-2.5 py-1.5 text-xs text-primary-foreground"
            >
              Apply
            </button>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-md border border-border px-2.5 py-1.5 text-xs text-text-secondary hover:bg-elevated"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-4">
          <label className="block text-[10px] text-text-muted">
            From date
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-0.5 w-full rounded-md border border-border bg-elevated px-2 py-1.5 text-xs text-text-primary"
            />
          </label>
          <label className="block text-[10px] text-text-muted">
            To date
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-0.5 w-full rounded-md border border-border bg-elevated px-2 py-1.5 text-xs text-text-primary"
            />
          </label>
        </div>
      </div>

      {composeOpen ? (
        <div className="min-w-0 border-b border-border bg-surface px-3 py-3 sm:px-6">
          <div className="mb-2 flex min-w-0 items-center justify-between">
            <p className="text-xs font-semibold text-text-primary">New message</p>
            <button
              type="button"
              onClick={() => setComposeOpen(false)}
              className="text-text-muted hover:text-text-secondary"
              aria-label="Close compose"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="block text-[10px] text-text-muted">
              To
              <input
                type="email"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                className="mt-0.5 w-full rounded-md border border-border bg-elevated px-2 py-1.5 text-xs text-text-primary"
                placeholder="recipient@example.com"
              />
            </label>
            <label className="block text-[10px] text-text-muted">
              Subject
              <input
                type="text"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                className="mt-0.5 w-full rounded-md border border-border bg-elevated px-2 py-1.5 text-xs text-text-primary"
                placeholder="Subject"
              />
            </label>
          </div>
          <label className="mt-2 block text-[10px] text-text-muted">
            Body
            <textarea
              value={composeBody}
              onChange={(e) => setComposeBody(e.target.value)}
              rows={5}
              className="mt-0.5 w-full rounded-md border border-border bg-elevated px-2 py-1.5 text-xs text-text-primary"
              placeholder="Write your message"
            />
          </label>
          {composeError ? (
            <p className="mt-1 text-[10px] text-danger">{composeError}</p>
          ) : null}
          <div className="mt-2 grid grid-cols-2 gap-2 sm:flex">
            <button
              type="button"
              disabled={sending || !composeTo.trim() || !composeSubject.trim()}
              onClick={() => void sendCompose()}
              className="rounded-md bg-accent px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Send via Gmail'}
            </button>
            <button
              type="button"
              onClick={() => setComposeOpen(false)}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-elevated"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
        <div className="flex w-full shrink-0 flex-col border-b border-border lg:w-52 lg:border-b-0 lg:border-r">
          <div className="flex gap-1 overflow-x-auto p-2 [scrollbar-width:none] lg:block lg:space-y-0.5 lg:overflow-visible [&::-webkit-scrollbar]:hidden">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  'shrink-0 rounded-md px-2 py-1.5 text-left text-xs lg:w-full',
                  tab === item.id
                    ? 'bg-elevated text-text-primary'
                    : 'text-text-secondary hover:bg-elevated',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          {webhookUrl && (
            <div className="hidden border-t border-border p-2 lg:mt-auto lg:block">
              <p className="mb-1 text-[10px] font-semibold uppercase text-text-muted">Inbound webhook</p>
              <p className="break-all text-[10px] text-text-muted">{webhookUrl}</p>
            </div>
          )}
        </div>

        <div className="flex min-h-[14rem] w-full shrink-0 flex-col border-b border-border lg:min-h-0 lg:w-80 lg:border-b-0 lg:border-r">
          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <Spinner />
            </div>
          ) : filteredRows.length === 0 ? (
            <EmptyState
              icon={<Mail className="h-8 w-8" />}
              title="No messages"
              subtitle={
                hasActiveFilters
                  ? 'No messages match these filters. Clear filters or Sync now.'
                  : tab === 'sent'
                    ? 'Send from Compose or Sync now to pull Gmail Sent. Agent sends appear under Aiva.'
                    : tab === 'inbox'
                      ? 'Sync now pulls Gmail Inbox (replies and new mail) as Google.'
                      : tab === 'draft_reply'
                        ? 'Drafts awaiting approval or saved replies appear here.'
                        : 'Use Compose, Sync now, or the inbound webhook. Filter by Aiva / Google above.'
              }
            />
          ) : (
            <div className="flex-1 overflow-y-auto">
              {filteredRows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedId(row.id)}
                  className={cn(
                    'w-full min-w-0 border-b border-border px-3 py-2.5 text-left transition-colors',
                    selectedId === row.id ? 'bg-elevated' : 'hover:bg-elevated/60',
                  )}
                >
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium text-text-primary">
                      {row.status === 'sent' && row.toAddress
                        ? `To: ${row.toAddress}`
                        : row.fromAddress}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <OriginBadge origin={classifyEmailOrigin(row)} />
                      <span className={cn('rounded px-1.5 py-0.5 text-[10px]', urgencyClass(row.urgency))}>
                        {row.urgency}
                      </span>
                    </div>
                  </div>
                  <p className="truncate text-xs text-text-secondary">{row.subject}</p>
                  <p className="mt-0.5 line-clamp-1 text-[10px] text-text-muted">
                    {row.bodyPreview || 'No preview'}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4">
            <CoreSurfaceBanner surface="email" />

            {!selected ? (
              <p className="text-sm text-text-muted">Select a message to read, or Compose a new one.</p>
            ) : (
              <>
                <div className="mb-4">
                  <div className="mb-2">
                    <OriginBadge origin={classifyEmailOrigin(selected)} />
                  </div>
                  <p className="text-xs text-text-muted">From</p>
                  <p className="text-sm text-text-primary">{selected.fromAddress}</p>
                  {selected.toAddress ? (
                    <>
                      <p className="mt-2 text-xs text-text-muted">To</p>
                      <p className="text-sm text-text-primary">{selected.toAddress}</p>
                    </>
                  ) : null}
                  <p className="mt-2 text-xs text-text-muted">Subject</p>
                  <p className="text-sm font-medium text-text-primary">{selected.subject}</p>
                  <div className="mt-4 whitespace-pre-wrap break-words text-sm text-text-secondary">
                    {selected.bodyFull || selected.bodyPreview || '(empty body)'}
                  </div>
                </div>

                {!isSentView ? (
                  <div className="rounded-lg border border-border bg-surface p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
                        <Sparkles className="h-3.5 w-3.5 text-accent" />
                        Draft reply
                      </p>
                      {!selected.aiDraftReply && (
                        <button
                          type="button"
                          onClick={generateDraft}
                          disabled={drafting}
                          className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-[10px] text-primary-foreground disabled:opacity-50"
                        >
                          {drafting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                          Generate draft
                        </button>
                      )}
                    </div>
                    <CarinaEditor
                      value={draftText}
                      onChange={setDraftText}
                      placeholder="Generate a draft or write your own reply."
                      variant="compact"
                      minHeight="12rem"
                    />
                    {approvalNotice ? (
                      <p className="mt-2 text-[10px] text-text-muted">
                        {approvalNotice}{' '}
                        {approvalNotice.includes('Queued') ? (
                          <a href="/aiva/approvals" className="text-accent hover:underline">
                            Open Approvals
                          </a>
                        ) : null}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={saveDraft}
                        className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-elevated"
                      >
                        Save draft
                      </button>
                      <button
                        type="button"
                        disabled={submittingApproval || !draftText.trim()}
                        onClick={() => void submitForApproval()}
                        className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50"
                      >
                        {submittingApproval ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Send className="h-3 w-3" />
                        )}
                        Submit for approval
                      </button>
                      <button
                        type="button"
                        onClick={() => setDraftText('')}
                        className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-elevated"
                      >
                        Discard
                      </button>
                      <button
                        type="button"
                        onClick={archiveMessage}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-elevated"
                      >
                        <Archive className="h-3 w-3" />
                        Archive
                      </button>
                      <button
                        type="button"
                        onClick={markSpam}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-danger hover:bg-elevated"
                      >
                        <Trash2 className="h-3 w-3" />
                        Spam
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
