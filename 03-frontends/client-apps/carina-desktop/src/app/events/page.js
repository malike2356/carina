import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { openEventsStream } from '../../lib/gateway-client.js';
import { downloadTextFile } from '../../lib/artifacts-store.js';
function colorForType(type) {
    if (type.includes('tool'))
        return 'text-blue-400';
    if (type.includes('agent'))
        return 'text-purple-400';
    if (type.includes('approval'))
        return 'text-orange-400';
    if (type.includes('error'))
        return 'text-red-400';
    return 'text-zinc-400';
}
export default function EventsPage() {
    const [events, setEvents] = useState([]);
    const [filter, setFilter] = useState('all');
    const [query, setQuery] = useState('');
    const [autoScroll, setAutoScroll] = useState(true);
    useEffect(() => {
        let es = null;
        void openEventsStream((raw) => {
            const record = raw;
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
            if (filter !== 'all' && !event.type.includes(filter))
                return false;
            if (!q)
                return true;
            return event.summary.toLowerCase().includes(q) || event.type.toLowerCase().includes(q);
        });
    }, [events, filter, query]);
    useEffect(() => {
        if (!autoScroll)
            return;
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, [filtered, autoScroll]);
    return (_jsxs("div", { className: "min-h-screen bg-zinc-950 text-zinc-100 p-4", children: [_jsxs("div", { className: "flex flex-wrap gap-2 mb-4", children: [_jsx("h1", { className: "text-sm font-semibold", children: "Event monitor" }), _jsxs("select", { value: filter, onChange: (e) => setFilter(e.target.value), className: "ml-auto text-xs bg-zinc-900 border border-zinc-700 rounded px-2 py-1", children: [_jsx("option", { value: "all", children: "All" }), _jsx("option", { value: "tool", children: "Tool" }), _jsx("option", { value: "agent", children: "Agent" }), _jsx("option", { value: "approval", children: "Approval" }), _jsx("option", { value: "error", children: "Error" })] }), _jsx("input", { value: query, onChange: (e) => setQuery(e.target.value), placeholder: "Search", className: "text-xs bg-zinc-900 border border-zinc-700 rounded px-2 py-1" }), _jsxs("label", { className: "text-xs text-zinc-400 flex items-center gap-1", children: [_jsx("input", { type: "checkbox", checked: autoScroll, onChange: (e) => setAutoScroll(e.target.checked) }), "Auto-scroll"] }), _jsx("button", { type: "button", onClick: () => downloadTextFile('carina-events.json', JSON.stringify(filtered, null, 2), 'application/json'), className: "text-xs border border-zinc-700 rounded px-2 py-1", children: "Export" })] }), _jsx("div", { className: "space-y-2", children: filtered.map((event) => (_jsxs("div", { className: "rounded-lg border border-zinc-800 bg-zinc-900 p-3", children: [_jsxs("div", { className: "flex items-center gap-2 text-xs", children: [_jsx("span", { className: colorForType(event.type), children: event.type }), _jsx("span", { className: "text-zinc-600", children: new Date(event.timestamp).toLocaleTimeString() }), event.durationMs !== undefined && _jsxs("span", { className: "text-zinc-600", children: [event.durationMs, "ms"] })] }), _jsx("pre", { className: "mt-2 text-[11px] text-zinc-400 whitespace-pre-wrap break-all", children: event.summary })] }, event.id))) })] }));
}
