import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
export default function ThinkingBlock({ content, isStreaming }) {
    const [open, setOpen] = useState(false);
    return (_jsxs("div", { className: "border border-zinc-700 rounded-md mb-2 overflow-hidden", children: [_jsxs("button", { type: "button", onClick: () => setOpen((v) => !v), className: "w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-800 text-left", children: [_jsx("span", { className: `transition-transform ${open ? 'rotate-90' : ''}`, children: '>' }), _jsx("span", { children: isStreaming ? 'Thinking...' : 'Reasoning' }), isStreaming && _jsx("span", { className: "ml-auto animate-pulse text-zinc-600", children: "..." })] }), open && (_jsx("div", { className: "px-3 pb-3 pt-1 text-xs text-zinc-500 font-mono whitespace-pre-wrap border-t border-zinc-700", children: content || (isStreaming ? 'Working through the request...' : 'No reasoning captured.') }))] }));
}
