'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { OriginBadge } from '@/components/ui/OriginBadge';
import { OriginFilterChips } from '@/components/ui/OriginFilterChips';
import { Spinner } from '@/components/ui/Spinner';
import {
  classifyFromCalendarSource,
  matchesOriginFilter,
  type OriginFilter,
} from '@/lib/sync-ownership';
import { cn } from '@/lib/utils';

type ViewMode = 'month' | 'week' | 'agenda';

interface CalendarEventRow {
  id: string;
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt?: string | null;
  allDay: boolean;
  source: string;
  noteId?: string | null;
}

interface ParsePreview {
  title: string;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function startOfWeek(date: Date): Date {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  start.setHours(0, 0, 0, 0);
  return start;
}

function endOfWeek(date: Date): Date {
  const end = startOfWeek(date);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function formatTime(value: string, allDay: boolean): string {
  if (allDay) return 'All day';
  return new Date(value).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function eventOrigin(event: CalendarEventRow) {
  return classifyFromCalendarSource(event.source);
}

export default function CalendarPage() {
  const [view, setView] = useState<ViewMode>('month');
  const [cursor, setCursor] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState<CalendarEventRow | null>(null);
  const [nlInput, setNlInput] = useState('');
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState<ParsePreview | null>(null);
  const [saving, setSaving] = useState(false);
  const [quickDay, setQuickDay] = useState<Date | null>(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [originFilter, setOriginFilter] = useState<OriginFilter>('all');
  const [syncProvider, setSyncProvider] = useState<'google' | 'caldav' | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const range = useMemo(() => {
    if (view === 'week') {
      return { start: startOfWeek(cursor), end: endOfWeek(cursor) };
    }
    if (view === 'agenda') {
      const start = new Date(cursor);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 30);
      return { start, end };
    }
    const start = startOfMonth(cursor);
    const gridStart = startOfWeek(start);
    const end = endOfWeek(endOfMonth(cursor));
    return { start: gridStart, end };
  }, [view, cursor]);

  const filteredEvents = useMemo(
    () =>
      events.filter((event) =>
        matchesOriginFilter({ origin: eventOrigin(event) }, originFilter),
      ),
    [events, originFilter],
  );

  async function loadConnectionMeta() {
    const res = await fetch('/api/calendar/connection');
    const data = await res.json();
    if (data.data) {
      setSyncProvider(data.data.provider === 'google' ? 'google' : 'caldav');
      setLastSyncAt(data.data.lastSyncAt ?? null);
    }
  }

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    });
    const res = await fetch(`/api/calendar/events?${params}`);
    const data = await res.json();
    if (data.data) setEvents(data.data);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [range.start.toISOString(), range.end.toISOString()]);

  useEffect(() => {
    void loadConnectionMeta();
  }, []);

  async function syncCalendar() {
    setSyncing(true);
    await fetch('/api/calendar/sync', { method: 'POST' });
    setSyncing(false);
    await loadConnectionMeta();
    await load();
  }

  async function parseNl(event: FormEvent) {
    event.preventDefault();
    if (!nlInput.trim()) return;
    setParsing(true);
    const res = await fetch('/api/calendar/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phrase: nlInput }),
    });
    const data = await res.json();
    setParsing(false);
    if (data.data) setPreview(data.data);
  }

  async function savePreview() {
    if (!preview) return;
    setSaving(true);
    await fetch('/api/calendar/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preview),
    });
    setSaving(false);
    setPreview(null);
    setNlInput('');
    await load();
  }

  async function saveQuickAdd() {
    if (!quickDay || !quickTitle.trim()) return;
    const startsAt = new Date(quickDay);
    startsAt.setHours(9, 0, 0, 0);
    await fetch('/api/calendar/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: quickTitle.trim(),
        startsAt: startsAt.toISOString(),
        allDay: true,
      }),
    });
    setQuickDay(null);
    setQuickTitle('');
    await load();
  }

  async function deleteSelected() {
    if (!selected) return;
    const origin = eventOrigin(selected);
    if (origin === 'google' || selected.id.startsWith('note-')) return;
    await fetch(`/api/calendar/events/${selected.id}`, { method: 'DELETE' });
    setSelected(null);
    await load();
  }

  const monthCells = useMemo(() => {
    const cells: Date[] = [];
    const current = new Date(range.start);
    while (current <= range.end) {
      cells.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return cells;
  }, [range.start, range.end]);

  const titleLabel =
    view === 'month'
      ? cursor.toLocaleDateString([], { month: 'long', year: 'numeric' })
      : view === 'week'
        ? `Week of ${startOfWeek(cursor).toLocaleDateString([], { month: 'short', day: 'numeric' })}`
        : 'Next 30 days';

  const syncLabel = syncProvider === 'google' ? 'Sync Google' : 'Sync CalDAV';

  const showDetailPanel = Boolean(quickDay || selected);
  const visibleEventLimit = view === 'week' ? 8 : 5;

  return (
    <div className="flex h-full min-w-0 flex-col overflow-x-hidden">
      <header className="flex min-w-0 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-3 py-2 sm:px-4">
        <h1 className="text-base font-semibold text-text-primary">Calendar</h1>
        <div className="flex items-center gap-0.5">
          {(['month', 'week', 'agenda'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              className={cn(
                'rounded-md px-2 py-1 text-xs capitalize',
                view === mode ? 'bg-elevated text-text-primary' : 'text-text-muted hover:text-text-primary',
              )}
            >
              {mode}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5">
          <IconButton
            label="Previous"
            onClick={() =>
              setCursor(
                new Date(
                  cursor.getFullYear(),
                  cursor.getMonth() + (view === 'week' ? 0 : -1),
                  cursor.getDate() - (view === 'week' ? 7 : 0),
                ),
              )
            }
          >
            <ChevronLeft className="h-4 w-4" />
          </IconButton>
          <span className="min-w-0 px-1 text-center text-sm font-medium text-text-primary sm:min-w-32">
            {titleLabel}
          </span>
          <IconButton
            label="Next"
            onClick={() =>
              setCursor(
                new Date(
                  cursor.getFullYear(),
                  cursor.getMonth() + (view === 'week' ? 0 : 1),
                  cursor.getDate() + (view === 'week' ? 7 : 0),
                ),
              )
            }
          >
            <ChevronRight className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="grid w-full grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-2 sm:ml-auto sm:flex sm:w-auto sm:flex-wrap">
          {lastSyncAt ? (
            <span className="hidden text-[10px] text-text-muted md:inline" title={new Date(lastSyncAt).toLocaleString()}>
              Synced {new Date(lastSyncAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void syncCalendar()}
            className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-text-secondary hover:bg-elevated"
          >
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {syncLabel}
          </button>
          <Link
            href="/settings/calendar"
            className="rounded-md border border-border p-1.5 text-text-secondary hover:bg-elevated"
            title="Calendar settings"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <div className="flex min-w-0 shrink-0 flex-col gap-2 border-b border-border px-3 py-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:px-4">
        <OriginFilterChips value={originFilter} onChange={setOriginFilter} className="shrink-0" />
        <form onSubmit={parseNl} className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 sm:flex-nowrap">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent" />
          <input
            value={nlInput}
            onChange={(e) => setNlInput(e.target.value)}
            placeholder='Quick add: "call Telemachus tomorrow morning"'
            className="min-w-[11rem] flex-1 rounded-md border border-border bg-elevated px-2.5 py-1.5 text-sm text-text-primary outline-none"
          />
          <button
            type="submit"
            disabled={parsing || !nlInput.trim()}
            className="min-w-0 shrink-0 rounded-md bg-accent px-2.5 py-1.5 text-xs text-white disabled:opacity-50"
          >
            {parsing ? 'Parsing...' : 'Parse'}
          </button>
        </form>
        {preview ? (
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 rounded-md border border-accent/30 bg-accent-dim/20 px-2.5 py-1.5 text-xs">
            <span className="min-w-0 text-text-primary">
              {preview.title} · {formatTime(preview.startsAt, preview.allDay)}
            </span>
            <button
              type="button"
              onClick={savePreview}
              disabled={saving}
              className="rounded-md bg-accent px-2 py-1 text-white"
            >
              {saving ? 'Saving...' : 'Save event'}
            </button>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="text-text-muted hover:text-text-primary"
            >
              Cancel
            </button>
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          'grid min-h-0 min-w-0 flex-1 overflow-hidden',
          showDetailPanel ? 'grid-cols-1 lg:grid-cols-[minmax(0,1fr)_18rem]' : 'grid-cols-1',
        )}
      >
        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden p-2 sm:p-3">
          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <Spinner />
            </div>
          ) : view === 'agenda' ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              {filteredEvents.length === 0 ? (
                <EmptyState
                  icon={<CalendarDays className="h-8 w-8" />}
                  title="No upcoming events"
                  subtitle="Add events in Aiva, parse quick-add text, or sync Google / CalDAV after you configure it."
                />
              ) : (
                <div className="space-y-2">
                  {filteredEvents
                    .slice()
                    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
                    .map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => setSelected(event)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-left hover:bg-elevated"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm text-text-primary">{event.title}</p>
                          <p className="text-xs text-text-muted">{formatTime(event.startsAt, event.allDay)}</p>
                        </div>
                        <OriginBadge origin={eventOrigin(event)} />
                      </button>
                    ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-1">
              <div className="grid shrink-0 grid-cols-7 gap-1">
                {WEEKDAY_LABELS.map((label) => (
                  <div
                    key={label}
                    className="min-w-0 px-1 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-text-muted"
                  >
                    <span className="sm:hidden">{label.slice(0, 1)}</span>
                    <span className="hidden sm:inline">{label}</span>
                  </div>
                ))}
              </div>
              <div
                className="grid min-h-0 flex-1 grid-cols-7 gap-1"
                style={{ gridAutoRows: 'minmax(0, 1fr)' }}
              >
                {monthCells.map((day) => {
                  const dayEvents = filteredEvents.filter((event) =>
                    sameDay(new Date(event.startsAt), day),
                  );
                  const inMonth = day.getMonth() === cursor.getMonth() || view === 'week';
                  const overflow = Math.max(0, dayEvents.length - visibleEventLimit);
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => {
                        setQuickDay(day);
                        setSelected(null);
                      }}
                      className={cn(
                        'flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-border p-1 text-left hover:bg-elevated sm:p-1.5',
                        !inMonth && view === 'month' && 'opacity-40',
                      )}
                    >
                      <span className="shrink-0 text-xs font-medium text-text-secondary">
                        {day.getDate()}
                      </span>
                      <div className="mt-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                        {dayEvents.slice(0, visibleEventLimit).map((event) => (
                          <div
                            key={event.id}
                            role="presentation"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected(event);
                              setQuickDay(null);
                            }}
                            className="truncate rounded bg-accent-dim px-1 py-0.5 text-left text-[11px] leading-tight text-accent sm:text-xs"
                            title={event.title}
                          >
                            {event.title}
                          </div>
                        ))}
                        {overflow > 0 ? (
                          <span className="truncate px-1 text-[10px] text-text-muted">+{overflow} more</span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {showDetailPanel ? (
          <aside className="min-w-0 overflow-y-auto border-t border-border p-3 lg:border-l lg:border-t-0 lg:p-4">
            {quickDay ? (
              <div className="mb-4 rounded-lg border border-border p-3">
                <p className="mb-2 text-xs font-semibold text-text-primary">
                  Quick add on {quickDay.toLocaleDateString()}
                </p>
                <input
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  placeholder="Event title"
                  className="mb-2 w-full rounded-md border border-border bg-elevated px-2 py-1.5 text-xs"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={saveQuickAdd}
                    className="rounded-md bg-accent px-2 py-1 text-xs text-white"
                  >
                    <Plus className="mr-1 inline h-3 w-3" /> Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickDay(null)}
                    className="text-xs text-text-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {selected ? (
              <div>
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-sm font-semibold text-text-primary">{selected.title}</p>
                  <OriginBadge origin={eventOrigin(selected)} />
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  {formatTime(selected.startsAt, selected.allDay)}
                </p>
                <p className="mt-1 text-[10px] uppercase text-text-muted">Source: {selected.source}</p>
                {selected.description ? (
                  <p className="mt-3 whitespace-pre-wrap text-xs text-text-secondary">
                    {selected.description}
                  </p>
                ) : null}
                {selected.noteId ? (
                  <p className="mt-3 text-xs text-accent">Linked note reminder</p>
                ) : null}
                {eventOrigin(selected) === 'aiva' ? (
                  <button
                    type="button"
                    onClick={deleteSelected}
                    className="mt-4 text-xs text-danger hover:underline"
                  >
                    Delete event
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="mt-2 block text-xs text-text-muted"
                >
                  Close
                </button>
              </div>
            ) : null}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
