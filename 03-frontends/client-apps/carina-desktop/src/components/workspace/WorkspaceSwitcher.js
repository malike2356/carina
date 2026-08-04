import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { $activeWorkspace, $workspaces } from '../../store/carina.js';
import { createWorkspace, switchWorkspace } from '../../lib/gateway-client.js';
import { listSessions } from '../../lib/gateway-client.js';
import { $sessions } from '../../store/session.js';
const COLORS = ['#6366f1', '#22c55e', '#f97316', '#ec4899', '#06b6d4'];
export default function WorkspaceSwitcher({ compact, onSwitched }) {
    const workspaces = useStore($workspaces);
    const active = useStore($activeWorkspace);
    const sessions = useStore($sessions);
    const [open, setOpen] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [name, setName] = useState('');
    const [color, setColor] = useState(COLORS[0]);
    async function handleSwitch(id) {
        if (active?.id === id) {
            setOpen(false);
            return;
        }
        if (sessions.length > 0) {
            const ok = window.confirm('Switch workspace? Current sessions will remain available after reload.');
            if (!ok)
                return;
        }
        await switchWorkspace(id);
        const nextSessions = await listSessions();
        $sessions.set(nextSessions);
        onSwitched?.();
        setOpen(false);
    }
    async function handleCreate() {
        const trimmed = name.trim();
        if (!trimmed)
            return;
        await createWorkspace(trimmed, color, trimmed.slice(0, 1).toUpperCase());
        setName('');
        setModalOpen(false);
        onSwitched?.();
    }
    if (compact) {
        return (_jsx("button", { type: "button", title: active?.name ?? 'Workspace', onClick: () => setOpen((value) => !value), className: "h-8 w-8 rounded-lg text-xs font-semibold text-white", style: { backgroundColor: active?.color ?? '#6366f1' }, children: active?.icon ?? 'C' }));
    }
    return (_jsxs("div", { className: "relative", children: [_jsxs("button", { type: "button", onClick: () => setOpen((value) => !value), className: "w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800", children: [_jsx("span", { className: "h-7 w-7 rounded-md flex items-center justify-center text-xs font-semibold text-white", style: { backgroundColor: active?.color ?? '#6366f1' }, children: active?.icon ?? 'C' }), _jsx("span", { className: "flex-1 text-left text-sm font-medium text-zinc-100 truncate", children: active?.name ?? 'Workspace' }), _jsx("span", { className: "text-zinc-500 text-xs", children: "v" })] }), open && (_jsxs("div", { className: "absolute left-0 right-0 top-full mt-1 z-20 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl p-2 space-y-1", children: [workspaces.map((workspace) => (_jsxs("button", { type: "button", onClick: () => void handleSwitch(workspace.id), className: "w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 text-left", children: [_jsx("span", { className: "h-6 w-6 rounded text-xs flex items-center justify-center text-white", style: { backgroundColor: workspace.color }, children: workspace.icon }), _jsx("span", { className: "flex-1 text-sm text-zinc-200 truncate", children: workspace.name }), _jsx("span", { className: "text-[10px] text-zinc-600", children: workspace.sessionCount }), active?.id === workspace.id && _jsx("span", { className: "text-green-400 text-xs", children: "ok" })] }, workspace.id))), _jsx("button", { type: "button", onClick: () => {
                            setModalOpen(true);
                            setOpen(false);
                        }, className: "w-full text-xs text-indigo-300 px-2 py-1.5 rounded hover:bg-zinc-800", children: "New workspace" })] })), modalOpen && (_jsx("div", { className: "fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4", children: _jsxs("div", { className: "w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 p-4 space-y-3", children: [_jsx("h3", { className: "text-sm font-semibold text-zinc-100", children: "Create workspace" }), _jsx("input", { value: name, onChange: (event) => setName(event.target.value), placeholder: "Workspace name", className: "w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-700 rounded" }), _jsx("div", { className: "flex gap-2", children: COLORS.map((item) => (_jsx("button", { type: "button", onClick: () => setColor(item), className: `h-6 w-6 rounded-full border ${color === item ? 'border-white' : 'border-transparent'}`, style: { backgroundColor: item } }, item))) }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx("button", { type: "button", onClick: () => setModalOpen(false), className: "text-xs px-3 py-1.5 text-zinc-400", children: "Cancel" }), _jsx("button", { type: "button", onClick: () => void handleCreate(), className: "text-xs px-3 py-1.5 bg-indigo-600 text-white rounded", children: "Create" })] })] }) }))] }));
}
