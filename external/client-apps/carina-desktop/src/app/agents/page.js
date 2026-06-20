import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { cancelAgent, getAgent, getAgents } from '../../lib/gateway-client.js';
import { ROUTES } from '../../lib/router-paths.js';
function statusBadge(status) {
    if (status === 'running')
        return 'text-green-400';
    if (status === 'failed')
        return 'text-red-400';
    return 'text-zinc-500';
}
export default function AgentsPage() {
    const [agents, setAgents] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [detail, setDetail] = useState(null);
    useEffect(() => {
        let active = true;
        const load = async () => {
            const rows = await getAgents();
            if (!active)
                return;
            setAgents(rows.slice(0, 50));
            if (!selectedId && rows[0])
                setSelectedId(rows[0].id);
        };
        void load();
        const timer = window.setInterval(() => void load(), 3000);
        return () => {
            active = false;
            window.clearInterval(timer);
        };
    }, [selectedId]);
    useEffect(() => {
        if (!selectedId) {
            setDetail(null);
            return;
        }
        void getAgent(selectedId).then(setDetail);
    }, [selectedId, agents]);
    return (_jsxs("div", { className: "flex flex-1 overflow-hidden", children: [_jsxs("div", { className: "w-72 border-r border-zinc-800 overflow-y-auto p-3 space-y-2", children: [_jsx("h1", { className: "text-sm font-semibold text-zinc-100 px-1", children: "Agents" }), agents.length === 0 && (_jsx("p", { className: "text-xs text-zinc-500 px-1", children: "No subagents yet. Spawn one from chat with a task." })), agents.map((agent) => (_jsxs("button", { type: "button", onClick: () => setSelectedId(agent.id), className: `w-full rounded-lg border px-3 py-2 text-left ${selectedId === agent.id ? 'border-indigo-500 bg-zinc-800' : 'border-zinc-800 hover:bg-zinc-900'}`, children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("span", { className: "text-sm text-zinc-100 truncate", children: agent.name }), _jsx("span", { className: `text-xs ${statusBadge(agent.status)}`, children: agent.status })] }), agent.task && _jsx("p", { className: "text-xs text-zinc-500 truncate mt-1", children: agent.task })] }, agent.id)))] }), _jsx("div", { className: "flex-1 overflow-y-auto p-4", children: !detail ? (_jsx("p", { className: "text-sm text-zinc-500", children: "Select an agent to inspect output." })) : (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("h2", { className: "text-lg font-medium text-zinc-100", children: detail.name }), _jsx("span", { className: `text-xs ${statusBadge(detail.status)}`, children: detail.status }), detail.status === 'running' && (_jsx("button", { type: "button", onClick: () => void cancelAgent(detail.id), className: "text-xs text-red-400 border border-red-800 rounded px-2 py-0.5", children: "Cancel" }))] }), detail.parentSessionId && (_jsx(Link, { to: ROUTES.chat, className: "text-xs text-indigo-400 hover:underline", children: "Open parent session" })), _jsxs("div", { className: "text-xs text-zinc-500", children: ["Started: ", detail.startedAt ? new Date(detail.startedAt).toLocaleString() : 'n/a', detail.endedAt ? ` | Ended: ${new Date(detail.endedAt).toLocaleString()}` : ''] }), _jsx("pre", { className: "rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-xs text-zinc-300 whitespace-pre-wrap", children: detail.output || 'No output captured yet.' }), detail.toolCalls && detail.toolCalls.length > 0 && (_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-zinc-300 mb-2", children: "Tool calls" }), _jsx("ul", { className: "space-y-1 text-xs text-zinc-400", children: detail.toolCalls.map((tool) => (_jsxs("li", { children: [tool.name, " (", tool.status, ")"] }, `${tool.name}-${tool.status}`))) })] }))] })) })] }));
}
