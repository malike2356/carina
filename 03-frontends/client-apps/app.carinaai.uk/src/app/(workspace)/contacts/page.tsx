'use client';

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/Spinner';
import {
  ContactDossier,
  type ContactRow,
  type ContactSourceKind,
} from '@/components/contacts/ContactDossier';
import { cn } from '@/lib/utils';
import { warnTone } from '@/lib/ui-tones';

export type { ContactRow, ContactSourceKind };

type ContactFormState = {
  id?: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  whatsapp: string;
  telegram: string;
  notes: string;
  tags: string;
};

const EMPTY_FORM: ContactFormState = {
  name: '',
  role: '',
  email: '',
  phone: '',
  whatsapp: '',
  telegram: '',
  notes: '',
  tags: '',
};

type SourceFilter = 'all' | ContactSourceKind;

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

function toForm(contact?: ContactRow | null): ContactFormState {
  if (!contact) return { ...EMPTY_FORM };
  return {
    id: contact.id,
    name: contact.name ?? '',
    role: contact.role ?? '',
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    whatsapp: contact.whatsapp ?? '',
    telegram: contact.telegram ?? '',
    notes: contact.notes ?? '',
    tags: Array.isArray(contact.tags) ? contact.tags.join(', ') : '',
  };
}

function formPayload(form: ContactFormState) {
  const tags = form.tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  return {
    name: form.name.trim(),
    role: form.role.trim() || undefined,
    email: form.email.trim() || undefined,
    phone: form.phone.trim() || undefined,
    whatsapp: form.whatsapp.trim() || undefined,
    telegram: form.telegram.trim() || undefined,
    notes: form.notes.trim() || undefined,
    tags: tags.length > 0 ? tags : undefined,
  };
}

type AutoSyncSchedule = {
  enabled: boolean;
  timesPerDay: number;
  timezone: string;
  lastRunAt: string | null;
  lastResult: { ok?: boolean; imported?: number; error?: string; at?: string } | null;
  configured?: boolean;
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<ContactFormState>(EMPTY_FORM);
  const [editorOpen, setEditorOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [googleConfigured, setGoogleConfigured] = useState<boolean | null>(null);
  const [schedule, setSchedule] = useState<AutoSyncSchedule | null>(null);
  const [listLimit, setListLimit] = useState(100);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => contacts.find((contact) => contact.id === selectedId) ?? null,
    [contacts, selectedId],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return contacts.filter((contact) => {
      if (sourceFilter !== 'all' && contact.source !== sourceFilter) return false;
      if (!needle) return true;
      const haystack = [
        contact.name,
        contact.email,
        contact.phone,
        contact.whatsapp,
        contact.telegram,
        contact.role,
        contact.notes,
        ...(contact.tags ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [contacts, query, sourceFilter]);

  const visible = useMemo(() => filtered.slice(0, listLimit), [filtered, listLimit]);

  useEffect(() => {
    setListLimit(100);
  }, [query, sourceFilter]);

  const counts = useMemo(() => {
    const bySource: Record<string, number> = {};
    for (const contact of contacts) {
      bySource[contact.source] = (bySource[contact.source] ?? 0) + 1;
    }
    return { total: contacts.length, bySource };
  }, [contacts]);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, statusRes, scheduleRes] = await Promise.all([
        fetch('/api/contacts'),
        fetch('/api/contacts-sync'),
        fetch('/api/contacts/schedule'),
      ]);
      const listData = await listRes.json().catch(() => ({}));
      const statusData = await statusRes.json().catch(() => ({}));
      const scheduleData = await scheduleRes.json().catch(() => ({}));
      if (!listRes.ok) {
        setError(listData.error ?? 'Could not load contacts');
        setContacts([]);
      } else {
        const rows = Array.isArray(listData.contacts) ? (listData.contacts as ContactRow[]) : [];
        setContacts(rows);
        setSelectedId((current) => {
          if (current && rows.some((row) => row.id === current)) return current;
          return rows[0]?.id ?? null;
        });
      }
      if (statusRes.ok) {
        setGoogleConfigured(Boolean(statusData.configured));
      }
      if (scheduleRes.ok && typeof scheduleData.enabled === 'boolean') {
        setSchedule({
          enabled: Boolean(scheduleData.enabled),
          timesPerDay: Number(scheduleData.timesPerDay) || 1,
          timezone: String(scheduleData.timezone ?? 'Europe/London'),
          lastRunAt: scheduleData.lastRunAt ?? null,
          lastResult: scheduleData.lastResult ?? null,
          configured: Boolean(scheduleData.configured),
        });
        if (typeof scheduleData.configured === 'boolean') {
          setGoogleConfigured(Boolean(scheduleData.configured));
        }
      }
    } catch {
      setError('Could not load contacts');
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    if (!editorOpen) return;
    if (creating) {
      setForm({ ...EMPTY_FORM });
      return;
    }
    setForm(toForm(selected));
  }, [editorOpen, creating, selected]);

  async function handleGoogleSync() {
    setSyncing(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/contacts-sync?action=google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Google sync failed');
      } else {
        setNotice(`Synced from Google: imported ${data.imported ?? 0}, skipped ${data.skipped ?? 0}.`);
        await loadContacts();
      }
    } catch {
      setError('Google sync failed');
    } finally {
      setSyncing(false);
    }
  }

  async function saveAutoSync(next: Partial<AutoSyncSchedule>) {
    setScheduleSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/contacts/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: next.enabled ?? schedule?.enabled ?? true,
          timesPerDay: next.timesPerDay ?? schedule?.timesPerDay ?? 1,
          timezone: next.timezone ?? schedule?.timezone ?? 'Europe/London',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Could not update auto-resync');
        return;
      }
      setSchedule({
        enabled: Boolean(data.enabled),
        timesPerDay: Number(data.timesPerDay) || 1,
        timezone: String(data.timezone ?? 'Europe/London'),
        lastRunAt: data.lastRunAt ?? null,
        lastResult: data.lastResult ?? null,
        configured: Boolean(data.configured),
      });
      setNotice(
        data.enabled
          ? `Auto-resync on (${data.timesPerDay ?? 1}x per day).`
          : 'Auto-resync off.',
      );
    } catch {
      setError('Could not update auto-resync');
    } finally {
      setScheduleSaving(false);
    }
  }

  async function handleCsvUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setSyncing(true);
    setError(null);
    setNotice(null);
    try {
      const csvContent = await file.text();
      const res = await fetch('/api/contacts-sync?action=csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent, filename: file.name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'CSV import failed');
      } else {
        setNotice(`CSV import: imported ${data.imported ?? 0}, skipped ${data.skipped ?? 0}.`);
        await loadContacts();
      }
    } catch {
      setError('CSV import failed');
    } finally {
      setSyncing(false);
    }
  }

  async function saveContact(event: FormEvent) {
    event.preventDefault();
    const payload = formPayload(form);
    if (payload.name.length < 1) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      if (creating || !form.id) {
        const res = await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? 'Could not create contact');
          return;
        }
        setNotice('Contact created');
        setCreating(false);
        setEditorOpen(false);
        await loadContacts();
        if (data.contact?.id) setSelectedId(data.contact.id);
      } else {
        const res = await fetch(`/api/contacts/${encodeURIComponent(form.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? 'Could not update contact');
          return;
        }
        setNotice(
          selected?.source === 'google'
            ? 'Google contact updated and local copy refreshed'
            : 'Contact updated',
        );
        setEditorOpen(false);
        await loadContacts();
      }
    } catch {
      setError('Could not save contact');
    } finally {
      setSaving(false);
    }
  }

  async function deleteContact(contact: ContactRow) {
    const label = contact.source === 'google'
      ? `Delete "${contact.name}" from Google Contacts and this workspace?`
      : `Delete "${contact.name}" from this workspace?`;
    if (!window.confirm(label)) return;
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/contacts/${encodeURIComponent(contact.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Could not delete contact');
        return;
      }
      setNotice('Contact deleted');
      setEditorOpen(false);
      setSelectedId(null);
      await loadContacts();
    } catch {
      setError('Could not delete contact');
    }
  }

  function openCreate() {
    setCreating(true);
    setEditorOpen(true);
    setForm({ ...EMPTY_FORM });
  }

  function openEdit(contact: ContactRow) {
    setCreating(false);
    setSelectedId(contact.id);
    setForm(toForm(contact));
    setEditorOpen(true);
  }

  async function patchSelectedContact(patch: Partial<ContactRow>) {
    if (!selected) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = {
        name: selected.name,
        role: patch.role !== undefined ? patch.role || undefined : selected.role,
        email: patch.email !== undefined ? patch.email || undefined : selected.email,
        phone: selected.phone,
        whatsapp: selected.whatsapp,
        telegram: selected.telegram,
        notes: patch.notes !== undefined ? patch.notes || undefined : selected.notes,
        tags: patch.tags !== undefined ? patch.tags : selected.tags,
      };
      const res = await fetch(`/api/contacts/${encodeURIComponent(selected.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Could not update contact');
        return;
      }
      setNotice('Contact updated');
      await loadContacts();
    } catch {
      setError('Could not update contact');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden bg-base">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-text-secondary" />
            <h1 className="text-sm font-semibold text-text-primary">Contacts</h1>
          </div>
          <p className="mt-0.5 text-[11px] text-text-muted">
            Browse, edit, and delete synced contacts. Google auto-resyncs on a schedule you can turn off. Your Aivas can search this directory and change the schedule when you ask.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {schedule ? (
            <label className="inline-flex items-center gap-2 rounded-md border border-border bg-elevated px-2.5 py-1.5 text-[11px] text-text-secondary">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-[var(--accent)]"
                checked={schedule.enabled}
                disabled={scheduleSaving}
                onChange={(event) => void saveAutoSync({ enabled: event.target.checked })}
              />
              Auto-resync
              <select
                value={schedule.timesPerDay}
                disabled={scheduleSaving || !schedule.enabled}
                onChange={(event) => void saveAutoSync({ timesPerDay: Number(event.target.value) })}
                className="rounded border border-border bg-base px-1.5 py-0.5 text-[11px] text-text-primary outline-none"
                aria-label="Times per day"
              >
                <option value={1}>1x / day</option>
                <option value={2}>2x / day</option>
                <option value={3}>3x / day</option>
                <option value={4}>4x / day</option>
              </select>
            </label>
          ) : null}
          <Button type="button" variant="outline" size="sm" disabled={loading || syncing} onClick={() => void loadContacts()}>
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={syncing} onClick={() => void handleGoogleSync()}>
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {syncing ? 'Syncing' : 'Resync Google'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={syncing}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            Import CSV
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => void handleCsvUpload(event)}
          />
          <Button type="button" size="sm" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            Add contact
          </Button>
        </div>
      </div>

      {googleConfigured === false ? (
        <div className={cn('border-b px-4 py-2 text-xs sm:px-6', warnTone.box, warnTone.textMuted)}>
          Google Contacts is not connected.{' '}
          <Link href="/aiva/tools?tool=google-contacts" className="underline underline-offset-2">
            Connect in Tools
          </Link>
          , then resync.
        </div>
      ) : null}

      {schedule?.lastResult ? (
        <div className="border-b border-border bg-surface/40 px-4 py-1.5 text-[11px] text-text-muted sm:px-6">
          Last auto-resync:{' '}
          {schedule.lastResult.ok === false
            ? schedule.lastResult.error ?? 'failed'
            : `imported ${schedule.lastResult.imported ?? 0}`}
          {schedule.lastRunAt ? ` · ${new Date(schedule.lastRunAt).toLocaleString()}` : ''}
        </div>
      ) : null}

      {error ? (
        <div className="border-b border-danger/30 bg-danger/10 px-4 py-2 text-xs text-danger sm:px-6">{error}</div>
      ) : null}
      {notice ? (
        <div className="border-b border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-800 dark:text-emerald-300 sm:px-6">
          {notice}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="flex w-full shrink-0 flex-col border-b border-border lg:w-[22rem] lg:border-b-0 lg:border-r">
          <div className="space-y-2 border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, email, phone, tags..."
                className="w-full rounded-md border border-border bg-base py-2 pl-8 pr-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent/50"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'google', 'manual', 'csv', 'imported'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSourceFilter(key)}
                  className={cn(
                    'rounded-md border px-2 py-1 text-[10px] font-medium transition-colors',
                    sourceFilter === key
                      ? 'border-accent/40 bg-accent/10 text-text-primary'
                      : 'border-border bg-elevated text-text-muted hover:bg-overlay',
                  )}
                >
                  {key === 'all' ? `All (${counts.total})` : `${sourceLabel(key as ContactSourceKind)} (${counts.bySource[key] ?? 0})`}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-10">
                <EmptyState
                  icon={<Users className="h-7 w-7" />}
                  title={contacts.length === 0 ? 'No contacts yet' : 'No matches'}
                  subtitle={
                    contacts.length === 0
                      ? 'Resync Google or import a CSV to populate your directory.'
                      : 'Try another search or source filter.'
                  }
                  action={
                    contacts.length === 0 ? (
                      <Button type="button" size="sm" onClick={() => void handleGoogleSync()}>
                        Resync Google
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <>
                {visible.map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(contact.id);
                      setCreating(false);
                      setEditorOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-start gap-3 border-b border-border px-3 py-3 text-left transition-colors hover:bg-surface',
                      selectedId === contact.id && 'bg-surface',
                    )}
                  >
                    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-[10px] font-semibold text-text-primary">
                      {initials(contact.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-text-primary">{contact.name}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-text-muted">
                        {contact.email || contact.phone || contact.role || 'No details'}
                      </span>
                      <span className="mt-1 inline-flex rounded border border-border px-1.5 py-0.5 text-[10px] text-text-muted">
                        {sourceLabel(contact.source)}
                      </span>
                    </span>
                  </button>
                ))}
                {filtered.length > visible.length ? (
                  <div className="p-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setListLimit((current) => current + 100)}
                    >
                      Show more ({visible.length} of {filtered.length})
                    </Button>
                  </div>
                ) : filtered.length > 100 ? (
                  <p className="px-3 py-2 text-center text-[10px] text-text-muted">
                    Showing all {filtered.length} matches
                  </p>
                ) : null}
              </>
            )}
          </div>
        </aside>

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {editorOpen ? (
            <form onSubmit={(event) => void saveContact(event)} className="w-full min-w-0 max-w-none space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-text-primary">
                  {creating ? 'Add contact' : `Edit ${form.name || 'contact'}`}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setEditorOpen(false);
                    setCreating(false);
                  }}
                  className="rounded-md p-1.5 text-text-muted hover:bg-elevated hover:text-text-primary"
                  aria-label="Close editor"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {!creating && selected?.source === 'google' ? (
                <p className="rounded-md border border-border bg-elevated px-3 py-2 text-[11px] text-text-muted">
                  This contact lives in Google. Saving updates Google Contacts, then refreshes the local copy.
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ['name', 'Name', true],
                    ['role', 'Role / company', false],
                    ['email', 'Email', false],
                    ['phone', 'Phone', false],
                    ['whatsapp', 'WhatsApp', false],
                    ['telegram', 'Telegram', false],
                  ] as const
                ).map(([key, label, required]) => (
                  <label key={key} className="block text-[11px] font-medium text-text-muted">
                    {label}
                    <input
                      required={required}
                      value={form[key]}
                      onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                      className="mt-1 w-full rounded-md border border-border bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50"
                    />
                  </label>
                ))}
              </div>
              <label className="block text-[11px] font-medium text-text-muted">
                Tags (comma separated)
                <input
                  value={form.tags}
                  onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-border bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50"
                />
              </label>
              <label className="block text-[11px] font-medium text-text-muted">
                Notes
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  rows={4}
                  className="mt-1 w-full rounded-md border border-border bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {saving ? 'Saving' : 'Save contact'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditorOpen(false);
                    setCreating(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : !selected ? (
            <div className="flex h-full items-center justify-center">
              <EmptyState
                icon={<Users className="h-8 w-8" />}
                title="Select a contact"
                subtitle="Choose someone from the list, or add a new contact."
                action={
                  <Button type="button" size="sm" onClick={openCreate}>
                    <Plus className="h-3.5 w-3.5" />
                    Add contact
                  </Button>
                }
              />
            </div>
          ) : (
            <ContactDossier
              contact={selected}
              saving={saving}
              onEdit={() => openEdit(selected)}
              onDelete={() => void deleteContact(selected)}
              onPatch={patchSelectedContact}
            />
          )}
        </main>
      </div>
    </div>
  );
}
