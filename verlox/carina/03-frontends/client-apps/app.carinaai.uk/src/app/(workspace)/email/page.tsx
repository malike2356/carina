'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Loader2,
  Mail,
  PenSquare,
  RefreshCw,
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

type FilterTab = 'inbox' | 'sent' | 'high' | 'archived' | 'spam';

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
  { id: 'archived', label: 'Archived', status: 'archived' },
  { id: 'spam', label: 'Spam', status: 'spam' },
];

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
    const params = new URLSearchParams({ meta: '1' });
    if (active.status) params.set('status', active.status);
    if (active.urgency) params.set('urgency', active.urgency);

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
  }, [tab]);

  useEffect(() => {
    setDraftText(selected?.aiDraftReply ?? '');
  }, [selected?.id, selected?.aiDraftReply]);

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
      if (tab !== 'sent') setTab('sent');
      else await load();
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

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Email</h1>
          <p className="text-xs text-text-muted">{EMAIL_ORIGIN_HELPER_TEXT}</p>
          <p className="mt-0.5 text-xs text-text-muted">
            Agent Gmail sends land under Aiva in Sent. Sync now pulls Gmail Sent as Google.
            Use{' '}
            <a href="/aiva/approvals" className="text-accent hover:underline">
              Approval inbox
            </a>{' '}
            for Email Handler drafts.
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
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setComposeOpen(true);
              setComposeError(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1.5 text-xs text-primary-foreground hover:opacity-90"
          >
            <PenSquare className="h-3.5 w-3.5" />
            Compose
          </button>
          <button
            type="button"
            onClick={() => void syncNow()}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-text-secondary hover:bg-elevated"
          >
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Sync now
          </button>
          <IconButton label="Refresh" onClick={load}>
            <RefreshCw className="h-4 w-4" />
          </IconButton>
        </div>
      </header>

      <div className="border-b border-border px-6 py-2">
        <OriginFilterChips value={originFilter} onChange={setOriginFilter} />
      </div>

      {composeOpen ? (
        <div className="border-b border-border bg-surface px-6 py-3">
          <div className="mb-2 flex items-center justify-between">
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
          <div className="mt-2 flex gap-2">
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

      <div className="flex flex-1 min-h-0">
        <div className="flex w-52 flex-col border-r border-border">
          <div className="space-y-0.5 p-2">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  'w-full rounded-md px-2 py-1.5 text-left text-xs',
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
            <div className="mt-auto border-t border-border p-2">
              <p className="mb-1 text-[10px] font-semibold uppercase text-text-muted">Inbound webhook</p>
              <p className="break-all text-[10px] text-text-muted">{webhookUrl}</p>
            </div>
          )}
        </div>

        <div className="flex w-80 flex-col border-r border-border">
          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <Spinner />
            </div>
          ) : filteredRows.length === 0 ? (
            <EmptyState
              icon={<Mail className="h-8 w-8" />}
              title="No messages"
              subtitle={
                tab === 'sent'
                  ? 'Send from Compose or Sync now to pull Gmail Sent. Agent sends appear under Aiva.'
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
                    'w-full border-b border-border px-3 py-2.5 text-left transition-colors',
                    selectedId === row.id ? 'bg-elevated' : 'hover:bg-elevated/60',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
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

        <div className="flex flex-1 flex-col min-w-0">
          <div className="flex-1 overflow-y-auto p-4">
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
                  <div className="mt-4 whitespace-pre-wrap text-sm text-text-secondary">
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
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={saveDraft}
                        className="rounded-md bg-accent px-3 py-1.5 text-xs text-primary-foreground hover:opacity-90"
                      >
                        Save draft
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
