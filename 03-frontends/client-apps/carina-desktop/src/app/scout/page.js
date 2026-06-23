import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useStore } from '@nanostores/react';
import { useNavigate } from 'react-router-dom';
import { $killSwitchActive, $killSwitchReason, $scoutConnected, $scoutUrl, $securityEvents, $trustScore, } from '../../store/carina.js';
import { ROUTES } from '../../lib/router-paths.js';
function scoreColor(score) {
    if (score >= 90)
        return '#22c55e';
    if (score >= 70)
        return '#eab308';
    if (score >= 50)
        return '#f97316';
    return '#ef4444';
}
export default function ScoutReportPage() {
    const score = useStore($trustScore);
    const events = useStore($securityEvents);
    const killSwitchActive = useStore($killSwitchActive);
    const killSwitchReason = useStore($killSwitchReason);
    const scoutConnected = useStore($scoutConnected);
    const scoutUrl = useStore($scoutUrl);
    const navigate = useNavigate();
    const history = Array.from({ length: 24 }, (_, index) => ({
        hour: index,
        value: Math.max(0, Math.min(100, score - 10 + ((index * 7) % 20))),
    }));
    return (_jsxs("div", { className: "flex-1 overflow-y-auto p-4 space-y-6", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { type: "button", onClick: () => navigate(ROUTES.chat), className: "text-xs text-zinc-500", children: "Back" }), _jsx("h1", { className: "text-lg font-semibold text-zinc-100", children: "Scout Security Report" })] }), killSwitchActive && (_jsxs("div", { className: "rounded-lg border border-red-800 bg-red-950/30 p-4 text-red-200", children: ["KILL SWITCH ACTIVE: ", killSwitchReason || 'Emergency suspension in effect'] })), _jsxs("section", { className: "grid gap-4 md:grid-cols-3", children: [_jsxs("div", { className: "rounded-lg border border-zinc-800 bg-zinc-900 p-4", children: [_jsx("p", { className: "text-xs text-zinc-500", children: "Trust score" }), _jsx("p", { className: "text-3xl font-bold mt-1", style: { color: scoreColor(score) }, children: score })] }), _jsxs("div", { className: "rounded-lg border border-zinc-800 bg-zinc-900 p-4", children: [_jsx("p", { className: "text-xs text-zinc-500", children: "Scout connection" }), _jsx("p", { className: `text-lg mt-1 ${scoutConnected ? 'text-green-400' : 'text-zinc-400'}`, children: scoutConnected ? 'Connected' : 'Disconnected' }), scoutUrl && _jsx("p", { className: "text-xs text-zinc-600 mt-1 truncate", children: scoutUrl })] }), _jsxs("div", { className: "rounded-lg border border-zinc-800 bg-zinc-900 p-4", children: [_jsx("p", { className: "text-xs text-zinc-500", children: "Kill switch" }), _jsx("p", { className: `text-lg mt-1 ${killSwitchActive ? 'text-red-400' : 'text-green-400'}`, children: killSwitchActive ? 'Triggered' : 'Normal' })] })] }), _jsxs("section", { children: [_jsx("h2", { className: "text-sm font-semibold text-zinc-200 mb-2", children: "Trust score history (24h)" }), _jsx("div", { className: "h-32 flex items-end gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-3", children: history.map((point) => (_jsx("div", { className: "flex-1 rounded-t bg-indigo-600/80", style: { height: `${point.value}%` }, title: `Hour ${point.hour}: ${point.value}` }, point.hour))) })] }), _jsxs("section", { children: [_jsx("h2", { className: "text-sm font-semibold text-zinc-200 mb-2", children: "Security events" }), _jsx("div", { className: "rounded-lg border border-zinc-800 overflow-hidden", children: _jsxs("table", { className: "w-full text-xs", children: [_jsx("thead", { className: "bg-zinc-900 text-zinc-500", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left px-3 py-2", children: "Severity" }), _jsx("th", { className: "text-left px-3 py-2", children: "Summary" }), _jsx("th", { className: "text-left px-3 py-2", children: "Time" })] }) }), _jsx("tbody", { children: events.map((event) => (_jsxs("tr", { className: "border-t border-zinc-800", children: [_jsx("td", { className: "px-3 py-2 text-zinc-400", children: event.severity }), _jsx("td", { className: "px-3 py-2 text-zinc-200", children: event.summary }), _jsx("td", { className: "px-3 py-2 text-zinc-600", children: new Date(event.at).toLocaleString() })] }, event.id))) })] }) })] }), scoutUrl && (_jsx("a", { href: scoutUrl, target: "_blank", rel: "noreferrer", className: "inline-block text-xs text-indigo-300", children: "Open Scout console" }))] }));
}
