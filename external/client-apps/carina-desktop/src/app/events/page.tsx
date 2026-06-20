import { useEffect, useMemo, useState } from 'react';
import { openEventsStream } from '../../lib/gateway-client.js';
import { downloadTextFile } from '../../lib/artifacts-store.js';

type EventRow = {
  id: string;
  type: string;
  timestamp: string;
  summary: string;
  durationMs?: number;
};

function colorForType(type: string): string {
  if (type.includes('tool')) return 'text-blue-400';
  if (type.includes('agent')) return 'text-purple-400';
  if (type.includes('approval')) return 'text-orange-400';
  if (type.includes('error')) return 'text-red-400';
  return 'text-zinc-400';
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    let es: EventSource | null = null;
    void openEventsStream((raw) => {
      const record = raw as Record<string, unknown>;
      const type = String(record.type ?? record.event ?? 'event');
      setEvents((prev) => [
        ...prev.slice(-499),
        {
          id: `${Date.now()}-${prev.length}`,
          type,
          timestamp: new Date().toISOString(),
          summary: JSON.stringify(record),
          durationMs: typeof record.durationMs === 'number' ? record.durationMs : undefined,
        },
      ]);
    }).then((stream) => {
      es = stream;
    }).catch(() => {
      setEvents([{
        id: 'offline',
        type: 'error',
        timestamp: new Date().toISOString(),
        summary: 'Event stream unavailable. Start gateway with observability routes enabled.',
      }]);
    });
    return () => es?.close();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((event) => {
      if (filter !== 'all' && !event.type.includes(filter)) return false;
      if (!q) return true;
      return event.summary.toLowerCase().includes(q) || event.type.toLowerCase().includes(q);
    });
  }, [events, filter, query]);

  useEffect(() => {
    if (!autoScroll) return;
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }, [filtered, autoScroll]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4">
      <div className="flex flex-wrap gap-2 mb-4">
        <h1 className="text-sm font-semibold">Event monitor</h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="ml-auto text-xs bg-zinc-900 border border-zinc-700 rounded px-2 py-1">
          <option value="all">All</option>
          <option value="tool">Tool</option>
          <option value="agent">Agent</option>
          <option value="approval">Approval</option>
          <option value="error">Error</option>
        </select>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="text-xs bg-zinc-900 border border-zinc-700 rounded px-2 py-1" />
        <label className="text-xs text-zinc-400 flex items-center gap-1">
          <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
          Auto-scroll
        </label>
        <button type="button" onClick={() => downloadTextFile('carina-events.json', JSON.stringify(filtered, null, 2), 'application/json')} className="text-xs border border-zinc-700 rounded px-2 py-1">
          Export
        </button>
      </div>
      <div className="space-y-2">
        {filtered.map((event) => (
          <div key={event.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <div className="flex items-center gap-2 text-xs">
              <span className={colorForType(event.type)}>{event.type}</span>
              <span className="text-zinc-600">{new Date(event.timestamp).toLocaleTimeString()}</span>
              {event.durationMs !== undefined && <span className="text-zinc-600">{event.durationMs}ms</span>}
            </div>
            <pre className="mt-2 text-[11px] text-zinc-400 whitespace-pre-wrap break-all">{event.summary}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
