import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listSessions } from '../../lib/gateway-client.js';
import { ROUTES } from '../../lib/router-paths.js';
import { useSessionActions } from '../../hooks/use-session-actions.js';
function timeAgo(value) {
    const diff = Date.now() - new Date(value).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60)
        return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60)
        return `${m} min ago`;
    const h = Math.floor(m / 60);
    if (h < 24)
        return `${h} hr ago`;
    return `${Math.floor(h / 24)}d ago`;
}
function getGreeting() {
    const h = new Date().getHours();
    if (h < 12)
        return 'Good morning';
    if (h < 18)
        return 'Good afternoon';
    return 'Good evening';
}
const COLORS = ['#3b82f6', '#9b59f5', '#f59e0b', '#16c97e', '#00d4ff'];
export default function LauncherPage() {
    const navigate = useNavigate();
    const { createNewSession, selectSession } = useSessionActions();
    const [sessions, setSessions] = useState([]);
    useEffect(() => {
        void listSessions().then(setSessions).catch(() => setSessions([]));
    }, []);
    const recent = sessions.slice(0, 3);
    const latest = sessions[0];
    const handleContinue = () => {
        if (latest) {
            selectSession(latest.sessionId);
            navigate(ROUTES.chat);
            return;
        }
        void createNewSession().then(() => navigate(ROUTES.chat));
    };
    return (_jsxs("div", { className: "flex flex-col h-screen overflow-hidden", style: { background: '#060c18', color: '#e8f0f8' }, children: [_jsxs("div", { className: "grid flex-1 overflow-hidden", style: { gridTemplateColumns: '380px 1fr' }, children: [_jsxs("div", { className: "flex flex-col justify-center gap-10 p-12 border-r", style: { borderColor: '#1a2b45' }, children: [_jsxs("div", { children: [_jsx("p", { className: "text-[38px] font-bold leading-none", style: { color: '#e8f0f8' }, children: "Carina" }), _jsx("p", { className: "text-[10px] font-medium tracking-[0.15em] uppercase mt-2", style: { color: '#4a6a8a' }, children: "ONE MEMORY. ONE AGENT. EVERYWHERE." })] }), _jsxs("div", { children: [_jsxs("h2", { className: "text-2xl font-semibold mb-1.5", children: [getGreeting(), "."] }), _jsxs("p", { className: "text-sm", style: { color: '#6b8aaa' }, children: [sessions.length, " session", sessions.length !== 1 ? 's' : '', " on this device."] })] })] }), _jsx("div", { className: "flex items-center justify-center p-12 overflow-y-auto", children: _jsxs("div", { className: "w-full max-w-[440px] flex flex-col gap-5", children: [_jsx("p", { className: "text-[10px] font-semibold tracking-[0.14em] uppercase", style: { color: '#4a6a8a' }, children: "PICK UP WHERE YOU LEFT OFF" }), _jsx("div", { className: "flex flex-col gap-2", children: recent.length > 0 ? recent.map((s, i) => (_jsxs("button", { type: "button", onClick: () => { selectSession(s.sessionId); navigate(ROUTES.chat); }, className: "grid items-center gap-3.5 px-4 py-3.5 rounded-[10px] border text-left w-full cursor-pointer", style: { gridTemplateColumns: '44px 1fr auto', background: '#0d1829', borderColor: '#1a2b45' }, children: [_jsx("div", { className: "w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white", style: { background: COLORS[i % COLORS.length] }, children: (s.title ?? s.sessionId)[0]?.toUpperCase() ?? 'C' }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-sm font-semibold truncate", children: s.title ?? 'Untitled chat' }), _jsx("p", { className: "text-xs mt-0.5", style: { color: '#6b8aaa' }, children: "Local session" })] }), _jsx("span", { className: "text-xs whitespace-nowrap", style: { color: '#6b8aaa' }, children: timeAgo(s.updatedAt) })] }, s.sessionId))) : (_jsx("p", { className: "text-[13px]", style: { color: '#4a6a8a' }, children: "No sessions yet. Start one below." })) }), _jsxs("button", { type: "button", onClick: handleContinue, className: "flex items-center justify-center gap-3 w-full py-[18px] px-6 rounded-lg text-sm font-bold tracking-[0.1em] uppercase border-none cursor-pointer mt-2", style: { background: '#00d4ff', color: '#060c18' }, children: [latest ? 'CONTINUE WORK' : 'START NEW CHAT', " ", _jsx("span", { children: "\u2192" })] })] }) })] }), _jsxs("div", { className: "flex items-center gap-6 px-6 h-10 border-t shrink-0 text-[11px]", style: { background: '#060c18', borderColor: '#1a2b45', color: '#6b8aaa' }, children: [_jsx("span", { children: "Gateway connected" }), _jsx("span", { children: "Encrypted" }), _jsx("span", { className: "ml-auto", children: "Carina Desktop" })] })] }));
}
