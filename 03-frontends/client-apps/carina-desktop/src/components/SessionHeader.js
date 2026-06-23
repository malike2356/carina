import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useStore } from '@nanostores/react';
import { $sessions, $currentSessionId } from '../store/session.js';
import { $messages, $isStreaming, $currentTurnId } from '../store/chat.js';
import { cancelRun } from '../lib/gateway-client.js';
export default function SessionHeader() {
    const sessions = useStore($sessions);
    const currentId = useStore($currentSessionId);
    const isStreaming = useStore($isStreaming);
    const turnId = useStore($currentTurnId);
    const messages = useStore($messages);
    const session = sessions.find((s) => s.sessionId === currentId);
    if (!session)
        return null;
    return (_jsxs("div", { className: "flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800 bg-zinc-950/50 flex-shrink-0", children: [_jsx("p", { className: "flex-1 text-sm font-medium text-zinc-200 truncate", children: session.title ?? 'New session' }), _jsxs("span", { className: "text-xs text-zinc-600", children: [messages.length, " messages"] }), isStreaming && currentId && turnId && (_jsx("button", { type: "button", onClick: () => void cancelRun(currentId, turnId), className: "text-xs text-red-400 hover:text-red-300 border border-red-800 rounded px-2 py-0.5", children: "Stop" }))] }));
}
