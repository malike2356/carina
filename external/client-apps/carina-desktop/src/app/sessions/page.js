import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listSessions } from '../../lib/gateway-client.js';
import { deleteLocalSession, loadLocalMessages, renameLocalSession, } from '../../lib/session-store.js';
import { exportSessionJson, exportSessionMarkdown, exportSessionText, } from '../../lib/artifacts-store.js';
import { saveTextWithDialog } from '../../lib/fs-dialogs.js';
import { ROUTES } from '../../lib/router-paths.js';
export default function SessionsPage() {
    const [sessions, setSessions] = useState([]);
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState('date');
    const [selected, setSelected] = useState(new Set());
    const navigate = useNavigate();
    async function refresh() {
        setSessions(await listSessions());
    }
    useEffect(() => {
        void refresh();
    }, []);
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        let rows = sessions.filter((s) => !q || (s.title ?? s.sessionId).toLowerCase().includes(q));
        rows = [...rows].sort((a, b) => {
            if (sort === 'messages')
                return b.messageCount - a.messageCount;
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
        return rows;
    }, [query, sessions, sort]);
    function toggleSelect(id) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id))
                next.delete(id);
            else
                next.add(id);
            return next;
        });
    }
    function exportOne(sessionId, format) {
        const messages = loadLocalMessages(sessionId);
        if (format === 'md')
            void saveTextWithDialog(`${sessionId}.md`, exportSessionMarkdown(sessionId, messages), 'text/markdown');
        if (format === 'json')
            void saveTextWithDialog(`${sessionId}.json`, exportSessionJson(sessionId, messages), 'application/json');
        if (format === 'txt')
            void saveTextWithDialog(`${sessionId}.txt`, exportSessionText(sessionId, messages));
    }
    function deleteOne(sessionId) {
        const count = loadLocalMessages(sessionId).length;
        if (!window.confirm(`Delete session with ${count} messages?`))
            return;
        deleteLocalSession(sessionId);
        void refresh();
    }
    function bulkDelete() {
        if (selected.size === 0)
            return;
        if (!window.confirm(`Delete ${selected.size} selected sessions?`))
            return;
        for (const id of selected)
            deleteLocalSession(id);
        setSelected(new Set());
        void refresh();
    }
    return (_jsxs("div", { className: "flex-1 overflow-y-auto p-4", children: [_jsxs("div", { className: "flex flex-wrap gap-3 mb-4", children: [_jsx("h1", { className: "text-lg font-semibold text-zinc-100", children: "Sessions" }), _jsx("input", { value: query, onChange: (e) => setQuery(e.target.value), placeholder: "Search sessions", className: "px-3 py-1.5 text-sm bg-zinc-900 border border-zinc-700 rounded-lg" }), _jsxs("select", { value: sort, onChange: (e) => setSort(e.target.value), className: "px-3 py-1.5 text-sm bg-zinc-900 border border-zinc-700 rounded-lg", children: [_jsx("option", { value: "date", children: "Sort by date" }), _jsx("option", { value: "messages", children: "Sort by message count" })] }), selected.size > 0 && (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", onClick: bulkDelete, className: "text-xs text-red-400 border border-red-800 rounded px-2 py-1", children: "Delete selected" }), _jsx("button", { type: "button", onClick: () => selected.forEach((id) => exportOne(id, 'md')), className: "text-xs text-zinc-300 border border-zinc-700 rounded px-2 py-1", children: "Export selected" })] }))] }), _jsx("div", { className: "space-y-2", children: filtered.map((session) => (_jsx("div", { className: "rounded-xl border border-zinc-800 bg-zinc-900 p-4", children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx("input", { type: "checkbox", checked: selected.has(session.sessionId), onChange: () => toggleSelect(session.sessionId) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("input", { defaultValue: session.title ?? 'New session', onBlur: (e) => {
                                            renameLocalSession(session.sessionId, e.target.value);
                                            void refresh();
                                        }, className: "w-full bg-transparent text-sm font-medium text-zinc-100 outline-none" }), _jsxs("p", { className: "text-xs text-zinc-500 mt-1", children: [new Date(session.updatedAt).toLocaleString(), " | ", session.messageCount, " messages | ", session.agentId] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "button", onClick: () => navigate(ROUTES.chat), className: "text-xs text-indigo-400", children: "Open" }), _jsx("button", { type: "button", onClick: () => exportOne(session.sessionId, 'md'), className: "text-xs text-zinc-400", children: "Export" }), _jsx("button", { type: "button", onClick: () => deleteOne(session.sessionId), className: "text-xs text-red-400", children: "Delete" })] })] }) }, session.sessionId))) })] }));
}
