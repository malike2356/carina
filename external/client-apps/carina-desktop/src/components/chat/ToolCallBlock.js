import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
function statusLabel(status) {
    if (status === 'running')
        return 'Running';
    if (status === 'error')
        return 'Error';
    return 'Done';
}
function statusClass(status) {
    if (status === 'running')
        return 'text-yellow-400';
    if (status === 'error')
        return 'text-red-400';
    return 'text-green-400';
}
export default function ToolCallBlock({ toolCall }) {
    const [open, setOpen] = useState(false);
    return (_jsxs("div", { className: "border border-zinc-700 rounded-md mb-1 overflow-hidden text-xs", children: [_jsxs("button", { type: "button", onClick: () => setOpen((v) => !v), className: "w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left", children: [_jsx("span", { className: "text-zinc-400 font-mono", children: toolCall.name }), _jsx("span", { className: `ml-auto ${statusClass(toolCall.status)}`, children: statusLabel(toolCall.status) }), toolCall.durationMs !== undefined && (_jsxs("span", { className: "text-zinc-600", children: [toolCall.durationMs, "ms"] })), _jsx("span", { className: `transition-transform ${open ? 'rotate-90' : ''} text-zinc-600`, children: '>' })] }), open && (_jsxs("div", { className: "border-t border-zinc-700 divide-y divide-zinc-800", children: [_jsxs("div", { className: "px-3 py-2", children: [_jsx("p", { className: "text-zinc-600 mb-1 uppercase tracking-wide text-[10px]", children: "Args" }), _jsx("pre", { className: "text-zinc-400 overflow-x-auto whitespace-pre-wrap break-all", children: JSON.stringify(toolCall.args, null, 2) })] }), toolCall.result !== undefined && (_jsxs("div", { className: "px-3 py-2", children: [_jsx("p", { className: "text-zinc-600 mb-1 uppercase tracking-wide text-[10px]", children: "Result" }), _jsx("pre", { className: `overflow-x-auto whitespace-pre-wrap break-all ${toolCall.status === 'error' ? 'text-red-400' : 'text-zinc-400'}`, children: typeof toolCall.result === 'string'
                                    ? toolCall.result
                                    : JSON.stringify(toolCall.result, null, 2) })] }))] }))] }));
}
