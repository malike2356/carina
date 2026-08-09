'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Bot,
  Calendar,
  ExternalLink,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Sparkles,
  Tag,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/Spinner';
import { warnTone } from '@/lib/ui-tones';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export type ContactSourceKind = 'carina' | 'imported' | 'manual' | 'google' | 'csv';

export type ContactRow = {
  id: string;
  name: string;
  role?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  telegram?: string;
  notes?: string;
  tags?: string[];
  source: ContactSourceKind;
  resourceName?: string;
};

type ActivityKind = 'email' | 'meeting';
type ActivityFilter = 'all' | ActivityKind;

type ActivityItem = {
  id: string;
  kind: ActivityKind;
  at: string;
  title: string;
  subtitle: string;
  href: string;
  meta?: string;
};

type ActivityPayload = {
  items: ActivityItem[];
  counts: { email: number; meeting: number; total: number };
};

function sourceLabel(source: ContactSourceKind): string {
  switch (source) {
    case 'google':
      return 'Google';
    case 'csv':
      return 'CSV';
    case 'manual':
      return 'Manual';
    case 'carina':
      return 'Carina';
    default:
      return 'Imported';
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function googleContactsUrl(contact: ContactRow): string | null {
  const resource = String(contact.resourceName || contact.id || '');
  const match = resource.match(/people\/c\/([^/?#]+)/i);
  if (match?.[1]) return `https://contacts.google.com/person/${match[1]}`;
  return null;
}

function digitsForDial(phone?: string): string | null {
  const raw = String(phone ?? '').trim();
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d+]/g, '');
  const digits = cleaned.replace(/\D+/g, '');
  if (digits.length < 7) return null;
  return cleaned.startsWith('+') ? `+${digits}` : digits;
}

function telHref(phone?: string): string | undefined {
  const dial = digitsForDial(phone);
  return dial ? `tel:${dial}` : undefined;
}

function whatsappUrl(phone?: string): string | null {
  const digits = String(phone ?? '').replace(/\D+/g, '');
  if (digits.length < 7) return null;
  return `https://wa.me/${digits}`;
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type ContactDossierProps = {
  contact: ContactRow;
  saving?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onPatch: (patch: Partial<ContactRow>) => Promise<void>;
};

export function ContactDossier({
  contact,
  saving = false,
  onEdit,
  onDelete,
  onPatch,
}: ContactDossierProps) {
  const [activity, setActivity] = useState<ActivityPayload | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [notes, setNotes] = useState(contact.notes ?? '');
  const [tagsText, setTagsText] = useState((contact.tags ?? []).join(', '));
  const [role, setRole] = useState(contact.role ?? '');
  const [emailDraft, setEmailDraft] = useState(contact.email ?? '');
  const [contextSaving, setContextSaving] = useState(false);
  const [completeSaving, setCompleteSaving] = useState(false);
  const [ringBusy, setRingBusy] = useState(false);
  const [ringNote, setRingNote] = useState<string | null>(null);

  useEffect(() => {
    setNotes(contact.notes ?? '');
    setTagsText((contact.tags ?? []).join(', '));
    setRole(contact.role ?? '');
    setEmailDraft(contact.email ?? '');
    setFilter('all');
  }, [contact.id, contact.notes, contact.tags, contact.role, contact.email]);

  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    setActivityError(null);
    try {
      const params = new URLSearchParams();
      if (contact.email) params.set('email', contact.email);
      if (contact.name) params.set('name', contact.name);
      if (contact.phone || contact.whatsapp) {
        params.set('phone', contact.phone || contact.whatsapp || '');
      }
      params.set('limit', '50');
      const res = await fetch(`/api/contacts/activity?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActivityError(data.error ?? 'Could not load activity');
        setActivity(null);
        return;
      }
      setActivity(data.data ?? { items: [], counts: { email: 0, meeting: 0, total: 0 } });
    } catch {
      setActivityError('Could not load activity');
      setActivity(null);
    } finally {
      setActivityLoading(false);
    }
  }, [contact.email, contact.name, contact.phone, contact.whatsapp]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  const filteredItems = useMemo(() => {
    const items = activity?.items ?? [];
    if (filter === 'all') return items;
    return items.filter((item) => item.kind === filter);
  }, [activity, filter]);

  const googleUrl = googleContactsUrl(contact);
  const phone = contact.phone || contact.whatsapp;
  const callHref = telHref(phone);
  const waUrl = whatsappUrl(phone);
  const sparse = !contact.email || !contact.role;

  const upcomingMeetings = useMemo(
    () =>
      (activity?.items ?? [])
        .filter((item) => item.kind === 'meeting' && new Date(item.at).getTime() >= Date.now())
        .slice(0, 4),
    [activity],
  );
  const openEmails = useMemo(
    () =>
      (activity?.items ?? [])
        .filter((item) => item.kind === 'email' && (item.meta === 'inbox' || item.meta === 'draft_reply'))
        .slice(0, 4),
    [activity],
  );

  async function ringMyPhone() {
    if (!phone) return;
    setRingBusy(true);
    setRingNote(null);
    try {
      const workersRes = await fetch('/api/aiva/workers');
      const workersData = await workersRes.json().catch(() => ({}));
      const workers = Array.isArray(workersData.workers)
        ? workersData.workers
        : Array.isArray(workersData.data)
          ? workersData.data
          : [];
      const worker = workers.find((row: { status?: string }) => row.status === 'active') ?? workers[0];
      const workerId = String(worker?.id ?? '');
      if (!workerId) {
        setRingNote('Hire or open an Aiva worker first, then try Ring my phone again.');
        return;
      }
      const res = await fetch(`/api/aiva/workers/${encodeURIComponent(workerId)}/voice/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: phone,
          mode: 'click_to_call',
          contactName: contact.name,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        setRingNote(data.error ?? 'Could not start click-to-call. Use Call to dial from this device.');
        return;
      }
      setRingNote('Your phone should ring now. Answer to connect to this contact.');
    } catch {
      setRingNote('Could not start click-to-call.');
    } finally {
      setRingBusy(false);
    }
  }

  async function saveContext(event?: FormEvent) {
    event?.preventDefault();
    setContextSaving(true);
    try {
      const tags = tagsText
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
      await onPatch({
        notes: notes.trim() || undefined,
        tags,
        role: role.trim() || undefined,
      });
    } finally {
      setContextSaving(false);
    }
  }

  async function saveCompleteStrip(event: FormEvent) {
    event.preventDefault();
    setCompleteSaving(true);
    try {
      const tags = tagsText
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
      await onPatch({
        email: emailDraft.trim() || undefined,
        role: role.trim() || undefined,
        tags,
      });
      await loadActivity();
    } finally {
      setCompleteSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-4 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-card text-sm font-semibold text-text-primary">
              {initials(contact.name)}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-text-primary">{contact.name}</h2>
              <p className="mt-0.5 text-xs text-text-muted">
                {contact.role || 'No role'} · {sourceLabel(contact.source)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onEdit}>
              Edit
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="text-danger hover:bg-danger/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
          {contact.email ? (
            <a
              href={`mailto:${contact.email}`}
              className="flex items-center gap-2 text-sm text-text-primary hover:underline"
            >
              <Mail className="h-4 w-4 text-text-muted" />
              {contact.email}
            </a>
          ) : (
            <p className="flex items-center gap-2 text-sm text-text-muted">
              <Mail className="h-4 w-4" />
              No email
            </p>
          )}
          {phone && callHref ? (
            <a href={callHref} className="flex items-center gap-2 text-sm text-text-primary hover:underline">
              <Phone className="h-4 w-4 text-text-muted" />
              {phone}
            </a>
          ) : (
            <p className="flex items-center gap-2 text-sm text-text-muted">
              <Phone className="h-4 w-4" />
              No phone
            </p>
          )}
          {contact.telegram ? (
            <p className="text-sm text-text-primary">Telegram: {contact.telegram}</p>
          ) : null}
          {contact.whatsapp && contact.whatsapp !== contact.phone ? (
            <p className="text-sm text-text-primary">WhatsApp: {contact.whatsapp}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <ActionChip
            href={contact.email ? `mailto:${contact.email}` : undefined}
            disabled={!contact.email}
            icon={<Mail className="h-3.5 w-3.5" />}
            label="Email"
          />
          <ActionChip
            href={callHref}
            disabled={!callHref}
            icon={<Phone className="h-3.5 w-3.5" />}
            label="Call"
          />
          <button
            type="button"
            disabled={!phone || ringBusy}
            onClick={() => void ringMyPhone()}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors',
              !phone || ringBusy
                ? 'cursor-not-allowed border-border/60 bg-elevated/40 text-text-muted/50'
                : 'border-border bg-elevated text-text-secondary hover:bg-overlay hover:text-text-primary',
            )}
          >
            {ringBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Phone className="h-3.5 w-3.5" />}
            Ring my phone
          </button>
          <ActionChip
            href={waUrl ?? undefined}
            disabled={!waUrl}
            icon={<MessageCircle className="h-3.5 w-3.5" />}
            label="WhatsApp"
            external
          />
          <ActionChip
            href="/calendar"
            icon={<Calendar className="h-3.5 w-3.5" />}
            label="Schedule"
          />
          <ActionChip
            href={`/aiva?ask=${encodeURIComponent(`Help me with contact ${contact.name}${contact.email ? ` (${contact.email})` : ''}`)}`}
            icon={<Bot className="h-3.5 w-3.5" />}
            label="Ask Aiva"
          />
          <ActionChip
            href={googleUrl ?? undefined}
            disabled={!googleUrl}
            icon={<ExternalLink className="h-3.5 w-3.5" />}
            label="Open in Google"
            external
          />
        </div>
        {ringNote ? (
          <p className="text-[11px] text-text-muted">{ringNote}</p>
        ) : null}

        {sparse ? (
          <form
            onSubmit={(event) => void saveCompleteStrip(event)}
            className={cn('rounded-lg p-4', warnTone.box)}
          >
            <p className={cn('text-xs font-semibold', warnTone.text)}>Complete this contact</p>
            <p className={cn('mt-1 text-[11px]', warnTone.textMuted)}>
              Add an email and role so Aiva can link emails, meetings, and follow-ups.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <label className={cn('block text-[11px] font-medium', warnTone.textLabel)}>
                Email
                <input
                  value={emailDraft}
                  onChange={(event) => setEmailDraft(event.target.value)}
                  placeholder="name@company.com"
                  className="mt-1 w-full rounded-md border border-border bg-base px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent/50"
                />
              </label>
              <label className={cn('block text-[11px] font-medium', warnTone.textLabel)}>
                Role / company
                <input
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  placeholder="e.g. Operations lead"
                  className="mt-1 w-full rounded-md border border-border bg-base px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent/50"
                />
              </label>
              <label className={cn('block text-[11px] font-medium', warnTone.textLabel)}>
                Tags
                <input
                  value={tagsText}
                  onChange={(event) => setTagsText(event.target.value)}
                  placeholder="client, vip"
                  className="mt-1 w-full rounded-md border border-border bg-base px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent/50"
                />
              </label>
            </div>
            <div className="mt-3">
              <Button type="submit" size="sm" disabled={completeSaving || saving}>
                {completeSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Save and link activity
              </Button>
            </div>
          </form>
        ) : null}

        <section className="rounded-lg border border-border bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Activity</h3>
              <p className="text-[11px] text-text-muted">
                Emails and meetings matched by address, phone, or name
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['all', `All (${activity?.counts.total ?? 0})`],
                  ['email', `Email (${activity?.counts.email ?? 0})`],
                  ['meeting', `Meetings (${activity?.counts.meeting ?? 0})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={cn(
                    'rounded-md border px-2 py-1 text-[10px] font-medium transition-colors',
                    filter === key
                      ? 'border-accent/40 bg-accent/10 text-text-primary'
                      : 'border-border bg-elevated text-text-muted hover:bg-overlay',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[28rem] overflow-y-auto">
            {activityLoading ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : activityError ? (
              <p className="px-4 py-8 text-center text-xs text-danger">{activityError}</p>
            ) : filteredItems.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm text-text-primary">No linked activity yet</p>
                <p className="mt-1 text-[11px] text-text-muted">
                  {contact.email
                    ? 'Add more detail, or wait for the next email/calendar sync.'
                    : 'Add an email or wait for the next sync.'}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {filteredItems.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-elevated/60"
                    >
                      <span
                        className={cn(
                          'mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border',
                          item.kind === 'email' ? 'bg-sky-500/10 text-sky-300' : 'bg-violet-500/10 text-violet-300',
                        )}
                      >
                        {item.kind === 'email' ? (
                          <Mail className="h-3.5 w-3.5" />
                        ) : (
                          <Calendar className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium text-text-primary">{item.title}</span>
                          <span className="shrink-0 text-[10px] text-text-muted">{formatWhen(item.at)}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-text-muted">
                          {item.subtitle}
                          {item.meta ? ` · ${item.meta}` : ''}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          <RelatedList
            title="Upcoming meetings"
            empty="No upcoming meetings linked"
            items={upcomingMeetings}
          />
          <RelatedList
            title="Open emails"
            empty="No open inbox threads linked"
            items={openEmails}
          />
        </div>
      </div>

      <aside className="w-full shrink-0 space-y-3 lg:w-72">
        <form
          onSubmit={(event) => void saveContext(event)}
          className="rounded-lg border border-border bg-surface p-4"
        >
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-text-primary">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            Aiva context
          </p>
          <p className="mb-3 text-[11px] text-text-muted">
            Notes and tags workers should know before they reply or book.
          </p>

          <label className="block text-[11px] font-medium text-text-muted">
            Role / company
            <input
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-base px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent/50"
            />
          </label>

          <label className="mt-3 block text-[11px] font-medium text-text-muted">
            <span className="inline-flex items-center gap-1">
              <Tag className="h-3 w-3" />
              Tags
            </span>
            <input
              value={tagsText}
              onChange={(event) => setTagsText(event.target.value)}
              placeholder="comma separated"
              className="mt-1 w-full rounded-md border border-border bg-base px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent/50"
            />
          </label>

          <label className="mt-3 block text-[11px] font-medium text-text-muted">
            Notes
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={6}
              placeholder="Preferences, do-not-contact flags, follow-ups..."
              className="mt-1 w-full rounded-md border border-border bg-base px-2.5 py-2 text-sm leading-5 text-text-primary outline-none focus:border-accent/50"
            />
          </label>

          <Button type="submit" size="sm" className="mt-3 w-full" disabled={contextSaving || saving}>
            {contextSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {contextSaving ? 'Saving' : 'Save context'}
          </Button>
        </form>

        <p className="px-1 text-[11px] text-text-muted">
          Import settings live under{' '}
          <Link href="/settings/contacts" className="underline underline-offset-2">
            Settings → Contacts
          </Link>
          .
        </p>
      </aside>
    </div>
  );
}

function ActionChip({
  href,
  label,
  icon,
  disabled,
  external,
}: {
  href?: string;
  label: string;
  icon: ReactNode;
  disabled?: boolean;
  external?: boolean;
}) {
  const className = cn(
    'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors',
    disabled
      ? 'cursor-not-allowed border-border/60 bg-elevated/40 text-text-muted/50'
      : 'border-border bg-elevated text-text-secondary hover:bg-overlay hover:text-text-primary',
  );

  if (disabled || !href) {
    return (
      <span className={className} aria-disabled>
        {icon}
        {label}
      </span>
    );
  }

  if (external || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('http')) {
    return (
      <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} className={className}>
        {icon}
        {label}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {icon}
      {label}
    </Link>
  );
}

function RelatedList({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: ActivityItem[];
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-[11px] text-text-muted">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className="block truncate text-xs text-text-primary hover:underline">
                {item.title}
              </Link>
              <p className="truncate text-[10px] text-text-muted">{formatWhen(item.at)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
