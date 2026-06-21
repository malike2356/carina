import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AgentsPage from '../agents/page.js';
import ArtifactsPage from '../artifacts/page.js';
import SessionsPage from '../sessions/page.js';
import SkillsPage from '../skills/page.js';
const TAB_ORDER = ['sessions', 'agents', 'artifacts', 'skills'];
const TAB_LABELS = {
    sessions: 'Sessions',
    agents: 'Agents',
    artifacts: 'Artifacts',
    skills: 'Skills',
};
function isWorkspaceTab(value) {
    return value === 'sessions' || value === 'agents' || value === 'artifacts' || value === 'skills';
}
export default function WorkspacePage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [manualTab, setManualTab] = useState(null);
    const activeTab = useMemo(() => {
        const fromUrl = searchParams.get('tab');
        if (isWorkspaceTab(fromUrl))
            return fromUrl;
        return manualTab ?? 'sessions';
    }, [manualTab, searchParams]);
    function setTab(tab) {
        setManualTab(tab);
        setSearchParams({ tab });
    }
    return (_jsxs("div", { className: "flex h-full min-h-0 flex-col bg-zinc-950", children: [_jsxs("div", { className: "border-b border-zinc-800 px-4 py-3", children: [_jsx("h1", { className: "text-sm font-semibold text-zinc-100", children: "Workspace" }), _jsx("p", { className: "mt-1 text-xs text-zinc-500", children: "Everything that changes the workspace, grouped in one place." }), _jsx("div", { className: "mt-3 flex flex-wrap gap-2", children: TAB_ORDER.map((tab) => (_jsx("button", { type: "button", onClick: () => setTab(tab), className: `rounded-md border px-3 py-1.5 text-sm ${activeTab === tab
                                ? 'border-indigo-500 bg-indigo-500/10 text-indigo-200'
                                : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'}`, children: TAB_LABELS[tab] }, tab))) })] }), _jsxs("div", { className: "min-h-0 flex-1 overflow-hidden", children: [activeTab === 'sessions' && _jsx(SessionsPage, {}), activeTab === 'agents' && _jsx(AgentsPage, {}), activeTab === 'artifacts' && _jsx(ArtifactsPage, {}), activeTab === 'skills' && _jsx(SkillsPage, {})] })] }));
}
