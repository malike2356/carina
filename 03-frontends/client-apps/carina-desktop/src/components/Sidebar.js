import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useStore } from '@nanostores/react';
import { $sessions, $currentSessionId, $sessionLoading } from '../store/session.js';
import { $gatewayStatus } from '../store/connection.js';
export default function Sidebar({ onSelectSession, onCreateSession }) {
    const sessions = useStore($sessions);
    const currentId = useStore($currentSessionId);
    const status = useStore($gatewayStatus);
    const loading = useStore($sessionLoading);
    const [query, setQuery] = useState('');
    const filteredSessions = useMemo(() => {
        const trimmed = query.trim().toLowerCase();
        if (!trimmed)
            return sessions;
        return sessions.filter((s) => (s.title ?? s.sessionId).toLowerCase().includes(trimmed));
    }, [query, sessions]);
    return (_jsxs("aside", { className: "w-64 flex flex-col border-r border-zinc-800 bg-zinc-900", children: [_jsxs("div", { className: "p-4 border-b border-zinc-800", children: [_jsx("span", { className: "text-sm font-semibold text-zinc-100", children: "Carina" }), _jsx("span", { className: `ml-2 text-xs ${status === 'ok' ? 'text-green-400' : 'text-red-400'}`, children: status })] }), _jsxs("div", { className: "p-3 border-b border-zinc-800 space-y-2", children: [_jsx("button", { type: "button", onClick: () => void onCreateSession(), className: "w-full px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg", children: "New session" }), _jsx("input", { type: "search", value: query, onChange: (e) => setQuery(e.target.value), placeholder: "Search sessions", className: "w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-700 rounded-lg text-zinc-200 placeholder:text-zinc-600" })] }), _jsxs("nav", { className: "flex-1 overflow-y-auto p-2 space-y-1", children: [loading && (_jsx("p", { className: "text-xs text-zinc-500 px-2 py-1", children: "Loading sessions..." })), !loading && filteredSessions.length === 0 && (_jsx("p", { className: "text-xs text-zinc-500 px-2 py-1", children: "No sessions yet" })), filteredSessions.map((s) => (_jsx("button", { type: "button", onClick: () => onSelectSession(s.sessionId), className: `w-full text-left px-3 py-2 rounded text-sm truncate ${s.sessionId === currentId
                            ? 'bg-zinc-700 text-zinc-100'
                            : 'text-zinc-400 hover:bg-zinc-800'}`, children: s.title ?? s.sessionId.slice(0, 12) }, s.sessionId)))] })] }));
}
