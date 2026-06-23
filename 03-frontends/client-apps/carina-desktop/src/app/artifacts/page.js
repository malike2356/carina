import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { getArtifacts } from '../../lib/gateway-client.js';
import { openCanvasWindow } from '../../lib/canvas-window.js';
import { sessionTitle } from '../../lib/artifacts-store.js';
const TYPE_LABELS = {
    html: 'HTML',
    svg: 'SVG',
    markdown: 'Markdown',
    code: 'Code',
    image: 'Image',
    data: 'Data',
};
export default function ArtifactsPage() {
    const [artifacts, setArtifacts] = useState([]);
    const [query, setQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    useEffect(() => {
        void getArtifacts().then(setArtifacts);
    }, []);
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return artifacts.filter((item) => {
            if (typeFilter !== 'all' && item.type !== typeFilter)
                return false;
            if (!q)
                return true;
            return item.title.toLowerCase().includes(q) || item.sessionId.toLowerCase().includes(q);
        });
    }, [artifacts, query, typeFilter]);
    return (_jsxs("div", { className: "flex-1 overflow-y-auto p-4", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-3 mb-4", children: [_jsx("h1", { className: "text-lg font-semibold text-zinc-100", children: "Artifacts" }), _jsx("input", { value: query, onChange: (e) => setQuery(e.target.value), placeholder: "Search artifacts", className: "ml-auto px-3 py-1.5 text-sm bg-zinc-900 border border-zinc-700 rounded-lg" }), _jsxs("select", { value: typeFilter, onChange: (e) => setTypeFilter(e.target.value), className: "px-3 py-1.5 text-sm bg-zinc-900 border border-zinc-700 rounded-lg", children: [_jsx("option", { value: "all", children: "All types" }), Object.entries(TYPE_LABELS).map(([value, label]) => (_jsx("option", { value: value, children: label }, value)))] })] }), filtered.length === 0 ? (_jsx("p", { className: "text-sm text-zinc-500", children: "No artifacts yet. Code blocks from chat appear here automatically." })) : (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3", children: filtered.map((artifact) => (_jsxs("article", { className: "rounded-xl border border-zinc-800 bg-zinc-900 p-4", children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase tracking-wide text-zinc-500", children: TYPE_LABELS[artifact.type] }), _jsx("h2", { className: "text-sm font-medium text-zinc-100 mt-1", children: artifact.title })] }), _jsxs("span", { className: "text-[10px] text-zinc-600", children: [artifact.size, " B"] })] }), _jsxs("p", { className: "text-xs text-zinc-500 mt-2", children: [sessionTitle(artifact.sessionId), " | ", new Date(artifact.createdAt).toLocaleString()] }), _jsx("button", { type: "button", onClick: () => void openCanvasWindow(artifact), className: "mt-3 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded px-2 py-1", children: "Open in Canvas" })] }, artifact.id))) }))] }));
}
