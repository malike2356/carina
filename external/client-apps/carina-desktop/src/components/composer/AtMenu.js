import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
const TYPE_LABEL = {
    session: 'Session',
    agent: 'Agent',
    skill: 'Skill',
};
export default function AtMenu({ query, targets, onSelect, onClose }) {
    const [activeIndex, setActiveIndex] = useState(0);
    useEffect(() => {
        setActiveIndex(0);
    }, [query, targets.length]);
    useEffect(() => {
        function onKeyDown(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
                return;
            }
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex((index) => Math.min(index + 1, Math.max(targets.length - 1, 0)));
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
            }
            if (event.key === 'Enter' && targets[activeIndex]) {
                event.preventDefault();
                onSelect(targets[activeIndex]);
            }
        }
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [activeIndex, onClose, onSelect, targets]);
    if (targets.length === 0) {
        return (_jsxs("div", { className: "absolute bottom-full left-0 right-0 mb-2 rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-xs text-zinc-500 shadow-xl", children: ["No mentions match \"", query, "\""] }));
    }
    return (_jsx("div", { className: "absolute bottom-full left-0 right-0 mb-2 max-h-64 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl", children: targets.map((target, index) => (_jsxs("button", { type: "button", onMouseDown: (event) => event.preventDefault(), onClick: () => onSelect(target), className: `flex w-full items-center gap-3 px-3 py-2 text-left text-sm ${index === activeIndex ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-300 hover:bg-zinc-800'}`, children: [_jsx("span", { className: "flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-[10px] uppercase text-zinc-400", children: target.type.slice(0, 1) }), _jsxs("span", { className: "min-w-0 flex-1", children: [_jsxs("span", { className: "block truncate text-zinc-200", children: ["@", target.name] }), _jsx("span", { className: "block truncate text-xs text-zinc-500", children: target.subtitle })] }), _jsx("span", { className: "rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500", children: TYPE_LABEL[target.type] })] }, `${target.type}-${target.id}`))) }));
}
