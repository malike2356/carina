import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
export default function MessageMetadata({ timestamp, model, onCopy }) {
    const [copied, setCopied] = useState(false);
    function handleCopy() {
        onCopy();
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }
    const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return (_jsxs("div", { className: "flex items-center gap-2 mt-1 text-[10px] text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity", children: [_jsx("span", { children: time }), model && _jsx("span", { className: "text-zinc-700", children: model }), _jsx("button", { type: "button", onClick: handleCopy, className: "hover:text-zinc-400", children: copied ? 'Copied' : 'Copy' })] }));
}
