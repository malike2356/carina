import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
function scoreColor(score) {
    if (score >= 90)
        return '#22c55e';
    if (score >= 70)
        return '#eab308';
    if (score >= 50)
        return '#f97316';
    return '#ef4444';
}
function timeAgo(iso) {
    const delta = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(delta / 60_000);
    if (mins < 1)
        return 'just now';
    if (mins < 60)
        return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24)
        return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}
export default function ScoutWidget({ score, events, killSwitchActive, killSwitchReason, scoutConnected, scoutUrl, expanded, compact, onToggle, onOpenReport, }) {
    const color = scoreColor(score);
    const circumference = 2 * Math.PI * 28;
    const offset = circumference - (score / 100) * circumference;
    if (compact && !expanded) {
        return (_jsxs("button", { type: "button", onClick: onToggle, className: "w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-zinc-800", children: [_jsx("span", { className: `h-2 w-2 rounded-full ${killSwitchActive ? 'bg-red-500' : scoutConnected ? 'bg-green-500' : 'bg-zinc-600'}` }), _jsxs("span", { className: "text-xs text-zinc-400", children: ["Scout ", score] })] }));
    }
    return (_jsxs("div", { className: "rounded-lg border border-zinc-800 bg-zinc-950 p-3 space-y-3", children: [_jsxs("button", { type: "button", onClick: onToggle, className: "w-full flex items-center justify-between text-left", children: [_jsx("span", { className: "text-xs font-semibold text-zinc-200", children: "Scout Security" }), _jsx("span", { className: "text-[10px] text-zinc-500", children: expanded ? 'Collapse' : 'Expand' })] }), killSwitchActive && (_jsxs("div", { className: "rounded border border-red-800 bg-red-950/40 px-2 py-1 text-xs text-red-300", children: ["KILL SWITCH ACTIVE: ", killSwitchReason || 'Emergency suspension'] })), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("svg", { width: "72", height: "72", viewBox: "0 0 72 72", className: "flex-shrink-0", children: [_jsx("circle", { cx: "36", cy: "36", r: "28", stroke: "#27272a", strokeWidth: "6", fill: "none" }), _jsx("circle", { cx: "36", cy: "36", r: "28", stroke: color, strokeWidth: "6", fill: "none", strokeDasharray: circumference, strokeDashoffset: offset, transform: "rotate(-90 36 36)" }), _jsx("text", { x: "36", y: "40", textAnchor: "middle", className: "fill-zinc-100 text-sm font-semibold", children: score })] }), _jsxs("div", { className: "text-xs text-zinc-400 space-y-1", children: [_jsx("p", { children: "Trust Score" }), _jsxs("p", { className: scoutConnected ? 'text-green-400' : 'text-zinc-500', children: ["Scout ", scoutConnected ? 'Connected' : 'Disconnected'] }), scoutUrl && _jsx("p", { className: "truncate max-w-[140px]", children: scoutUrl }), _jsx("p", { children: killSwitchActive ? 'Shield: triggered' : 'Shield: active' })] })] }), expanded && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "space-y-1", children: [_jsx("p", { className: "text-[10px] uppercase tracking-wide text-zinc-600", children: "Recent events" }), events.length === 0 && _jsx("p", { className: "text-xs text-zinc-600", children: "No recent events" }), events.map((event) => (_jsxs("div", { className: "flex items-start gap-2 text-xs", children: [_jsx("span", { className: event.severity === 'critical' ? 'text-red-400'
                                            : event.severity === 'warning' ? 'text-yellow-400'
                                                : 'text-zinc-500', children: event.severity }), _jsx("span", { className: "flex-1 text-zinc-300 truncate", children: event.summary }), _jsx("span", { className: "text-zinc-600", children: timeAgo(event.at) })] }, event.id)))] }), _jsx("button", { type: "button", onClick: onOpenReport, className: "w-full text-xs border border-zinc-700 rounded px-2 py-1 text-zinc-300", children: "View full report" })] }))] }));
}
