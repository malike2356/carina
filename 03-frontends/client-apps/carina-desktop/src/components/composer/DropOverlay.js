import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function DropOverlay({ visible }) {
    if (!visible)
        return null;
    return (_jsx("div", { className: "pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-black/50", children: _jsxs("div", { className: "rounded-xl border-2 border-dashed border-indigo-400 bg-zinc-900/90 px-8 py-6 text-center", children: [_jsx("p", { className: "text-sm font-medium text-zinc-100", children: "Drop to attach" }), _jsx("p", { className: "mt-1 text-xs text-zinc-400", children: "Files will be added to your message" })] }) }));
}
