import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { getHealth } from '../../../lib/gateway-client.js';
import { saveTextWithDialog } from '../../../lib/fs-dialogs.js';
import { checkForUpdates } from '../../../lib/updater.js';
export default function AboutSettingsPage() {
    async function exportDiagnostics() {
        const health = await getHealth();
        await saveTextWithDialog('carina-desktop-diagnostics.json', JSON.stringify({
            exportedAt: new Date().toISOString(),
            userAgent: navigator.userAgent,
            health,
            appearance: localStorage.getItem('carina_desktop_appearance'),
        }, null, 2), 'application/json');
    }
    async function handleCheckUpdates() {
        const update = await checkForUpdates();
        if (!update) {
            window.alert('You are on the latest version.');
        }
        else {
            window.alert(`Update available: ${update.version}`);
        }
    }
    return (_jsxs("div", { className: "space-y-6 max-w-2xl", children: [_jsxs("section", { children: [_jsx("h2", { className: "text-lg font-semibold text-zinc-100", children: "Carina Desktop" }), _jsx("p", { className: "text-sm text-zinc-400 mt-1", children: "Version 0.1.0" }), _jsx("p", { className: "text-xs text-zinc-600 mt-2", children: "Build: local development" })] }), _jsxs("section", { className: "space-y-2", children: [_jsx("button", { type: "button", onClick: () => void handleCheckUpdates(), className: "text-xs border border-zinc-700 rounded px-3 py-1.5 text-zinc-300", children: "Check for updates" }), _jsx("button", { type: "button", onClick: () => void exportDiagnostics(), className: "block text-xs border border-zinc-700 rounded px-3 py-1.5 text-zinc-300", children: "Export diagnostics" })] }), _jsxs("section", { children: [_jsx("h3", { className: "text-sm font-medium text-zinc-200", children: "License" }), _jsx("p", { className: "text-xs text-zinc-500 mt-1", children: "Carina agent is MIT licensed. See LICENSE in the repository root." })] }), _jsxs("section", { children: [_jsx("h3", { className: "text-sm font-medium text-zinc-200", children: "Recent changes" }), _jsx("ul", { className: "mt-2 space-y-1 text-xs text-zinc-500", children: _jsx("li", { children: "0.1.0 - Desktop scaffold, chat engine, composer, pages" }) })] })] }));
}
