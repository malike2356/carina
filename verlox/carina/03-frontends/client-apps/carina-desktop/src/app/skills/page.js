import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { getSkills, installSkill, searchHubSkills, uninstallSkill, } from '../../lib/gateway-client.js';
export default function SkillsPage() {
    const [tab, setTab] = useState('installed');
    const [installed, setInstalled] = useState([]);
    const [hubQuery, setHubQuery] = useState('');
    const [hubResults, setHubResults] = useState([]);
    const [selected, setSelected] = useState(null);
    useEffect(() => {
        void getSkills().then(setInstalled);
    }, []);
    useEffect(() => {
        if (tab !== 'hub')
            return;
        const timer = window.setTimeout(() => {
            void searchHubSkills(hubQuery).then(setHubResults);
        }, 300);
        return () => window.clearTimeout(timer);
    }, [hubQuery, tab]);
    const installedNames = useMemo(() => new Set(installed.map((s) => s.name)), [installed]);
    return (_jsxs("div", { className: "flex flex-1 overflow-hidden", children: [_jsxs("div", { className: "flex-1 overflow-y-auto p-4", children: [_jsxs("div", { className: "flex gap-2 mb-4", children: [_jsx("button", { type: "button", onClick: () => setTab('installed'), className: `px-3 py-1.5 text-sm rounded ${tab === 'installed' ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-300'}`, children: "Installed" }), _jsx("button", { type: "button", onClick: () => setTab('hub'), className: `px-3 py-1.5 text-sm rounded ${tab === 'hub' ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-300'}`, children: "Browse Hub" })] }), tab === 'installed' ? (_jsxs("div", { className: "space-y-2", children: [installed.length === 0 && _jsx("p", { className: "text-sm text-zinc-500", children: "No skill packs installed." }), installed.map((pack) => (_jsxs("button", { type: "button", onClick: () => setSelected(pack), className: "w-full text-left rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-700", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-sm font-medium text-zinc-100", children: pack.name }), _jsxs("label", { className: "text-xs text-zinc-400 flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: pack.enabled !== false, onChange: (e) => {
                                                            e.stopPropagation();
                                                            setInstalled((rows) => rows.map((row) => row.name === pack.name ? { ...row, enabled: e.target.checked } : row));
                                                        } }), "Enabled"] })] }), _jsx("p", { className: "text-xs text-zinc-500 mt-1", children: pack.description ?? 'No description' })] }, pack.name)))] })) : (_jsxs("div", { children: [_jsx("input", { value: hubQuery, onChange: (e) => setHubQuery(e.target.value), placeholder: "Search Carina Hub", className: "w-full mb-3 px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg" }), _jsx("div", { className: "space-y-2", children: hubResults.map((skill) => (_jsx("div", { className: "rounded-xl border border-zinc-800 bg-zinc-900 p-4", children: _jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-sm font-medium text-zinc-100", children: skill.name }), _jsx("p", { className: "text-xs text-zinc-500", children: skill.description })] }), _jsx("button", { type: "button", disabled: installedNames.has(skill.name), onClick: () => void installSkill(skill.name).then(() => getSkills().then(setInstalled)), className: "text-xs bg-indigo-600 disabled:opacity-50 text-white rounded px-2 py-1", children: "Install" })] }) }, skill.name))) })] }))] }), selected && (_jsxs("aside", { className: "w-80 border-l border-zinc-800 p-4 overflow-y-auto", children: [_jsx("h2", { className: "text-sm font-semibold text-zinc-100", children: selected.name }), _jsx("p", { className: "text-xs text-zinc-500 mt-2", children: selected.description ?? 'No description available.' }), 'enabled' in selected && (_jsx("button", { type: "button", onClick: () => void uninstallSkill(selected.name).then(() => getSkills().then(setInstalled)), className: "mt-4 text-xs text-red-400 border border-red-800 rounded px-2 py-1", children: "Uninstall" }))] }))] }));
}
