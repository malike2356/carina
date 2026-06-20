import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
export default function UpdateBanner({ version, body, onInstall, onDismiss }) {
    return (_jsxs("div", { className: "bg-indigo-950 border-b border-indigo-800 px-4 py-2 flex items-center gap-3 text-sm", children: [_jsxs("p", { className: "flex-1 text-indigo-100", children: ["Carina ", version, " is available.", body ? ` ${body}` : ''] }), _jsx("button", { type: "button", onClick: onInstall, className: "text-xs bg-indigo-600 text-white rounded px-2 py-1", children: "Update and restart" }), _jsx("button", { type: "button", onClick: onDismiss, className: "text-xs text-indigo-300", children: "Later" })] }));
}
