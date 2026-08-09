'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  Bell,
  CalendarDays,
  CheckSquare,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Repeat,
  Search,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';

type NoteRow = {
  id: string;
  title: string;
  content: string;
  reminderAt?: string | null;
  pinned: boolean;
  archived: boolean;
  updatedAt: string;
  createdAt: string;
};

type WorkerOption = {
  id: string;
  name: string;
};

type Filter = 'all' | 'reminders' | 'tasks' | 'notes';
type NoteKind = 'note' | 'task' | 'reminder';
type RecurringCadence = 'daily' | 'weekly';

type EditorState = {
  mode: 'create' | 'edit';
  id?: string;
  kind: NoteKind;
  title: string;
  content: string;
  reminderAtLocal: string;
};

type PromoteState = {
  note: NoteRow;
  workerId: string;
  cadence: RecurringCadence;
  scheduleText: string;
};

function kindOf(note: NoteRow): NoteKind {
  if (note.reminderAt) return 'reminder';
  if (note.pinned) return 'task';
  return 'note';
}

function formatWhen(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toLocalInputValue(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultReminderLocal(): string {
  return toLocalInputValue(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString());
}

function emptyCreate(kind: NoteKind = 'note'): EditorState {
  return {
    mode: 'create',
    kind,
    title: '',
    content: '',
    reminderAtLocal: kind === 'reminder' ? defaultReminderLocal() : '',
  };
}

function localTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function scheduleTextFromReminder(
  reminderAt: string | null | undefined,
  cadence: RecurringCadence,
): string {
  const d = reminderAt ? new Date(reminderAt) : new Date();
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  const hour = safe.getHours();
  const minute = safe.getMinutes();
  const timeLabel =
    minute === 0
      ? `${hour}:00`
      : `${hour}:${String(minute).padStart(2, '0')}`;
  if (cadence === 'weekly') {
    const weekday = safe.toLocaleDateString([], { weekday: 'long' });
    return `Every ${weekday} at ${timeLabel}`;
  }
  return `Every day at ${timeLabel}`;
}

function nudgePromptForNote(note: NoteRow): string {
  const title = (note.title || 'Untitled').trim();
  const details = (note.content || '').trim();
  return [
    'Send the workspace owner a short recurring nudge about this saved note.',
    `Title: ${title}`,
    details && details !== title ? `Details: ${details}` : null,
    `Note ID: ${note.id}`,
    'Keep it brief. Do not create a duplicate note or reminder.',
  ]
    .filter(Boolean)
    .join('\n');
}

export default function NotesPage() {
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [promote, setPromote] = useState<PromoteState | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [promoteSuccess, setPromoteSuccess] = useState<{
    workerId: string;
    automationId?: string;
    scheduleLabel?: string;
  } | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (showArchived) params.set('archived', '1');
      const res = await fetch(`/api/notes?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not load notes');
        setNotes([]);
        return;
      }
      setNotes(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadWorkers() {
    try {
      const res = await fetch('/api/aiva/workers');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setWorkers([]);
        return;
      }
      const list = Array.isArray(data.workers) ? data.workers : [];
      setWorkers(
        list
          .map((row: { id?: string; name?: string }) => ({
            id: String(row.id ?? ''),
            name: String(row.name ?? 'Aiva'),
          }))
          .filter((row: WorkerOption) => row.id),
      );
    } catch {
      setWorkers([]);
    }
  }

  useEffect(() => {
    void load();
    void loadWorkers();
  }, [showArchived]);

  useEffect(() => {
    if (!promote || promote.workerId || workers.length === 0) return;
    setPromote((prev) => (prev && !prev.workerId ? { ...prev, workerId: workers[0].id } : prev));
  }, [workers, promote]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 250);
    return () => window.clearTimeout(t);
  }, [search]);

  const filtered = useMemo(() => {
    return notes.filter((note) => {
      const kind = kindOf(note);
      if (filter === 'reminders') return kind === 'reminder';
      if (filter === 'tasks') return kind === 'task';
      if (filter === 'notes') return kind === 'note';
      return true;
    });
  }, [notes, filter]);

  function openCreate(kind: NoteKind = 'note') {
    setActionError(null);
    setPromoteSuccess(null);
    setEditor(emptyCreate(kind));
  }

  function openEdit(note: NoteRow) {
    setActionError(null);
    setPromoteSuccess(null);
    setEditor({
      mode: 'edit',
      id: note.id,
      kind: kindOf(note),
      title: note.title ?? '',
      content: note.content ?? '',
      reminderAtLocal: toLocalInputValue(note.reminderAt),
    });
  }

  function openPromote(note: NoteRow) {
    setActionError(null);
    setPromoteSuccess(null);
    const cadence: RecurringCadence = 'daily';
    setPromote({
      note,
      workerId: workers[0]?.id ?? '',
      cadence,
      scheduleText: scheduleTextFromReminder(note.reminderAt, cadence),
    });
    if (workers.length === 0) void loadWorkers();
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!editor) return;
    if (!editor.title.trim() && !editor.content.trim()) {
      setActionError('Add a title or details first.');
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      const title = editor.title.trim() || editor.content.trim().slice(0, 80) || 'Untitled note';
      const content = editor.content.trim() || title;
      const reminderAt =
        editor.kind === 'reminder'
          ? (editor.reminderAtLocal
            ? new Date(editor.reminderAtLocal).toISOString()
            : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString())
          : null;
      const pinned = editor.kind === 'task' || editor.kind === 'reminder';

      if (editor.mode === 'create') {
        const res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            content,
            kind: editor.kind,
            pinned,
            reminderAt,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setActionError(typeof data.error === 'string' ? data.error : 'Create failed');
          return;
        }
      } else if (editor.id) {
        const res = await fetch(`/api/notes/${editor.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            content,
            pinned,
            reminderAt,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setActionError(typeof data.error === 'string' ? data.error : 'Update failed');
          return;
        }
      }
      setEditor(null);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function patchNote(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setActionError(null);
    const previous = notes;
    setNotes((prev) =>
      prev.map((note) => (note.id === id ? { ...note, ...body, updatedAt: new Date().toISOString() } as NoteRow : note)),
    );
    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setNotes(previous);
        const data = await res.json().catch(() => ({}));
        setActionError(typeof data.error === 'string' ? data.error : 'Update failed');
        return;
      }
      await load();
    } catch (err) {
      setNotes(previous);
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  async function deleteNote(id: string) {
    if (!window.confirm('Delete this item permanently?')) return;
    setBusyId(id);
    setActionError(null);
    const previous = notes;
    setNotes((prev) => prev.filter((note) => note.id !== id));
    if (editor?.id === id) setEditor(null);
    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setNotes(previous);
        const data = await res.json().catch(() => ({}));
        setActionError(typeof data.error === 'string' ? data.error : 'Delete failed');
      }
    } catch (err) {
      setNotes(previous);
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  async function onPromote(e: FormEvent) {
    e.preventDefault();
    if (!promote) return;
    if (!promote.workerId) {
      setActionError('Pick an Aiva to run the recurring nudge.');
      return;
    }
    if (!promote.scheduleText.trim()) {
      setActionError('Add a schedule such as Every day at 9:00.');
      return;
    }
    setPromoting(true);
    setActionError(null);
    try {
      const title = (promote.note.title || 'Untitled').trim();
      const name = `Nudge: ${title}`.slice(0, 80);
      const description = nudgePromptForNote(promote.note);
      const res = await fetch(`/api/aiva/workers/${promote.workerId}/automations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          scheduleText: promote.scheduleText.trim(),
          timezone: localTimezone(),
          approvalMode: 'auto',
          action: {
            type: 'aiva_prompt',
            prompt: description,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data.error === 'string'
            ? data.error
            : 'Could not create recurring nudge (Team plan required for automations).';
        setActionError(msg);
        return;
      }
      setPromoteSuccess({
        workerId: promote.workerId,
        automationId: data.automation?.id ? String(data.automation.id) : undefined,
        scheduleLabel: data.automation?.scheduleLabel
          ? String(data.automation.scheduleLabel)
          : promote.scheduleText.trim(),
      });
      setPromote(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setPromoting(false);
    }
  }

  return (
    <div className="flex w-full min-w-0 max-w-none flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-text-primary">Notes</h1>
          <p className="mt-1 max-w-2xl text-sm text-text-secondary">
            Create, edit, and delete workspace notes, tasks, and one-shot reminders. Timed reminders
            appear on{' '}
            <Link href="/calendar" className="underline underline-offset-2">
              Calendar
            </Link>{' '}
            under Local only. Promote a reminder to a recurring Aiva nudge (Team plan automations).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-subtle px-3 text-sm text-text-secondary hover:bg-surface-raised"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => openCreate('note')}
            className="btn-primary inline-flex h-9 items-center gap-2 px-3 text-sm"
          >
            <Plus className="h-4 w-4" />
            New
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ['all', 'All'],
            ['reminders', 'Reminders'],
            ['tasks', 'Tasks'],
            ['notes', 'Notes'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              'rounded-full px-3 py-1 text-xs',
              filter === id
                ? 'border border-accent/40 bg-accent text-white'
                : 'border border-border-subtle text-text-secondary hover:bg-surface-raised',
            )}
          >
            {label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs text-text-muted">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived
        </label>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notes"
          className="h-10 w-full rounded-xl border border-border-subtle bg-surface-base pl-9 pr-3 text-sm text-text-primary outline-none focus:border-text-primary/40"
        />
      </div>

      {actionError ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-300">
          {actionError}
        </p>
      ) : null}

      {promoteSuccess ? (
        <p className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-text-primary">
          Recurring nudge created
          {promoteSuccess.scheduleLabel ? ` (${promoteSuccess.scheduleLabel})` : ''}.{' '}
          <Link
            href={`/aiva/workers/${promoteSuccess.workerId}?tab=automations`}
            className="underline underline-offset-2"
          >
            Open automations
          </Link>
        </p>
      ) : null}

      {promote ? (
        <form
          onSubmit={onPromote}
          className="rounded-2xl border border-border-subtle bg-surface-raised/40 p-4"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-text-primary">
              Make recurring: {promote.note.title || 'Untitled'}
            </h2>
            <button
              type="button"
              onClick={() => setPromote(null)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-raised"
              aria-label="Close promote form"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mb-3 text-xs text-text-muted">
            Creates an Aiva automation cron job. The original one-shot reminder stays on Notes /
            Calendar until you archive or delete it.
          </p>
          <label className="mb-3 block text-xs text-text-secondary">
            Aiva
            <select
              value={promote.workerId}
              onChange={(e) =>
                setPromote((prev) => (prev ? { ...prev, workerId: e.target.value } : prev))
              }
              className="mt-1 h-10 w-full rounded-lg border border-border-subtle bg-surface-base px-3 text-sm outline-none"
              required
            >
              <option value="">Select an Aiva</option>
              {workers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.name}
                </option>
              ))}
            </select>
          </label>
          <div className="mb-3 flex flex-wrap gap-2">
            {(
              [
                ['daily', 'Daily'],
                ['weekly', 'Weekly'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() =>
                  setPromote((prev) =>
                    prev
                      ? {
                        ...prev,
                        cadence: id,
                        scheduleText: scheduleTextFromReminder(prev.note.reminderAt, id),
                      }
                      : prev,
                  )
                }
                className={cn(
                  'rounded-full px-3 py-1 text-xs',
                  promote.cadence === id
                    ? 'border border-accent/40 bg-accent text-white'
                    : 'border border-border-subtle text-text-secondary',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="mb-3 block text-xs text-text-secondary">
            Schedule
            <input
              value={promote.scheduleText}
              onChange={(e) =>
                setPromote((prev) =>
                  prev ? { ...prev, scheduleText: e.target.value } : prev,
                )
              }
              placeholder="e.g. Every day at 9:00"
              className="mt-1 h-10 w-full rounded-lg border border-border-subtle bg-surface-base px-3 text-sm outline-none"
              required
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={promoting}
              className="btn-primary inline-flex h-9 items-center gap-2 px-3 text-sm disabled:opacity-60"
            >
              {promoting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Repeat className="h-4 w-4" />}
              Create recurring nudge
            </button>
            <button
              type="button"
              onClick={() => setPromote(null)}
              className="h-9 rounded-lg border border-border-subtle px-3 text-sm text-text-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {editor ? (
        <form
          onSubmit={onSave}
          className="rounded-2xl border border-border-subtle bg-surface-raised/40 p-4"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-text-primary">
              {editor.mode === 'create' ? 'Create' : 'Edit'}
            </h2>
            <button
              type="button"
              onClick={() => setEditor(null)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-raised"
              aria-label="Close editor"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            {(
              [
                ['note', 'Note'],
                ['task', 'Task'],
                ['reminder', 'Reminder'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() =>
                  setEditor((prev) =>
                    prev
                      ? {
                        ...prev,
                        kind: id,
                        reminderAtLocal:
                          id === 'reminder'
                            ? (prev.reminderAtLocal || defaultReminderLocal())
                            : '',
                      }
                      : prev,
                  )
                }
                className={cn(
                  'rounded-full px-3 py-1 text-xs',
                  editor.kind === id
                    ? 'border border-accent/40 bg-accent text-white'
                    : 'border border-border-subtle text-text-secondary',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <input
            value={editor.title}
            onChange={(e) => setEditor((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
            placeholder="Title"
            className="mb-2 h-10 w-full rounded-lg border border-border-subtle bg-surface-base px-3 text-sm outline-none"
          />
          <textarea
            value={editor.content}
            onChange={(e) => setEditor((prev) => (prev ? { ...prev, content: e.target.value } : prev))}
            placeholder="Details"
            rows={4}
            className="mb-3 w-full rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-sm outline-none"
          />
          {editor.kind === 'reminder' ? (
            <label className="mb-3 block text-xs text-text-secondary">
              Remind at
              <input
                type="datetime-local"
                value={editor.reminderAtLocal}
                onChange={(e) =>
                  setEditor((prev) => (prev ? { ...prev, reminderAtLocal: e.target.value } : prev))
                }
                className="mt-1 h-10 w-full rounded-lg border border-border-subtle bg-surface-base px-3 text-sm outline-none"
              />
            </label>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary inline-flex h-9 items-center gap-2 px-3 text-sm disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editor.mode === 'create' ? 'Create' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={() => setEditor(null)}
              className="h-9 rounded-lg border border-border-subtle px-3 text-sm text-text-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : error ? (
        <EmptyState
          icon={<StickyNote className="h-6 w-6" />}
          title="Could not load notes"
          subtitle={error}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<StickyNote className="h-6 w-6" />}
          title="No notes yet"
          subtitle="Use New to add a note, task, or reminder, or ask an Aiva from chat."
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((note) => {
            const kind = kindOf(note);
            const busy = busyId === note.id;
            return (
              <li
                key={note.id}
                className="rounded-2xl border border-border-subtle bg-surface-base p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]',
                          kind === 'reminder'
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            : kind === 'task'
                              ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                              : 'bg-surface-raised text-text-muted',
                        )}
                      >
                        {kind === 'reminder' ? (
                          <Bell className="h-3 w-3" />
                        ) : kind === 'task' ? (
                          <CheckSquare className="h-3 w-3" />
                        ) : (
                          <StickyNote className="h-3 w-3" />
                        )}
                        {kind}
                      </span>
                      {note.archived ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
                          <Archive className="h-3 w-3" />
                          archived
                        </span>
                      ) : null}
                    </div>
                    <h2 className="truncate text-base font-medium text-text-primary">
                      {note.title || 'Untitled'}
                    </h2>
                    {note.content && note.content !== note.title ? (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-text-secondary">
                        {note.content}
                      </p>
                    ) : null}
                    <p className="mt-2 font-mono text-[11px] text-text-muted">ID: {note.id}</p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {note.reminderAt ? (
                      <p className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatWhen(note.reminderAt)}
                      </p>
                    ) : (
                      <p className="text-xs text-text-muted">Updated {formatWhen(note.updatedAt)}</p>
                    )}
                    <div className="flex flex-wrap justify-end gap-1">
                      {note.reminderAt && !note.archived ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => openPromote(note)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-border-subtle px-2 text-xs text-text-secondary hover:bg-surface-raised disabled:opacity-50"
                        >
                          <Repeat className="h-3.5 w-3.5" />
                          Make recurring
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => openEdit(note)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-border-subtle px-2 text-xs text-text-secondary hover:bg-surface-raised disabled:opacity-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void patchNote(note.id, { archived: !note.archived })}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-border-subtle px-2 text-xs text-text-secondary hover:bg-surface-raised disabled:opacity-50"
                      >
                        {note.archived ? (
                          <ArchiveRestore className="h-3.5 w-3.5" />
                        ) : (
                          <Archive className="h-3.5 w-3.5" />
                        )}
                        {note.archived ? 'Restore' : 'Archive'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void deleteNote(note.id)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-500/30 px-2 text-xs text-red-700 hover:bg-red-500/10 disabled:opacity-50 dark:text-red-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                    {note.reminderAt ? (
                      <Link
                        href="/calendar"
                        className="text-xs underline underline-offset-2"
                      >
                        Open on Calendar
                      </Link>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
