import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useStore } from '@nanostores/react';
import { $pendingApproval } from '../../store/chat.js';
import { respondToApproval } from '../../lib/gateway-client.js';
export default function ApprovalDialog({ sessionId }) {
    const approval = useStore($pendingApproval);
    if (!approval)
        return null;
    async function respond(approved) {
        if (!approval)
            return;
        try {
            await respondToApproval(sessionId, approval.runId, approved);
        }
        finally {
            $pendingApproval.set(null);
        }
    }
    return (_jsx("div", { className: "fixed inset-0 bg-black/60 flex items-end justify-center z-50 p-4", children: _jsxs("div", { className: "bg-zinc-900 border border-zinc-700 rounded-xl p-5 max-w-lg w-full shadow-2xl", children: [_jsx("p", { className: "text-sm font-semibold text-zinc-100 mb-1", children: "Tool approval required" }), _jsx("p", { className: "text-xs text-zinc-400 mb-3", children: approval.reason }), _jsxs("div", { className: "bg-zinc-800 rounded-lg px-3 py-2 mb-4", children: [_jsx("p", { className: "text-xs text-zinc-500 mb-1 uppercase tracking-wide", children: "Tool" }), _jsx("p", { className: "text-sm font-mono text-zinc-200", children: approval.toolName }), _jsx("p", { className: "text-xs text-zinc-500 mt-2 mb-1 uppercase tracking-wide", children: "Params" }), _jsx("pre", { className: "text-xs text-zinc-400 overflow-x-auto whitespace-pre-wrap break-all", children: JSON.stringify(approval.params, null, 2) })] }), _jsxs("div", { className: "flex gap-3 justify-end", children: [_jsx("button", { type: "button", onClick: () => void respond(false), className: "px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 border border-zinc-700 rounded-lg", children: "Deny" }), _jsx("button", { type: "button", onClick: () => void respond(true), className: "px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg", children: "Approve" })] })] }) }));
}
