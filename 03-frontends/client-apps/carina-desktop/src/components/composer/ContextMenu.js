import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
export default function ContextMenu({ x, y, onCut, onCopy, onPaste, onClearDraft, onToggleQueue, onToggleVoice, onClose, }) {
    return (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "fixed inset-0 z-40 cursor-default", "aria-label": "Close context menu", onClick: onClose }), _jsxs("div", { className: "fixed z-50 min-w-44 rounded-lg border border-zinc-700 bg-zinc-900 py-1 text-sm shadow-xl", style: { left: x, top: y }, children: [_jsx(MenuItem, { label: "Cut", onClick: () => { onCut(); onClose(); } }), _jsx(MenuItem, { label: "Copy", onClick: () => { onCopy(); onClose(); } }), _jsx(MenuItem, { label: "Paste", onClick: () => { onPaste(); onClose(); } }), _jsx(Divider, {}), _jsx(MenuItem, { label: "Clear draft", onClick: () => { onClearDraft(); onClose(); } }), _jsx(Divider, {}), _jsx(MenuItem, { label: "Enable queue mode", onClick: () => { onToggleQueue(); onClose(); } }), _jsx(MenuItem, { label: "Toggle voice input", onClick: () => { onToggleVoice(); onClose(); } })] })] }));
}
function MenuItem({ label, onClick }) {
    return (_jsx("button", { type: "button", onClick: onClick, className: "block w-full px-3 py-1.5 text-left text-zinc-300 hover:bg-zinc-800", children: label }));
}
function Divider() {
    return _jsx("div", { className: "my-1 border-t border-zinc-800" });
}
