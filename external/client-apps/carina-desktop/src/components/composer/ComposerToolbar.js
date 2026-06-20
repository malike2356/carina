import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import VoiceRecorder from './VoiceRecorder.js';
export default function ComposerToolbar({ charCount, queueCount, queueMode, voiceRecording, voiceElapsedMs, voiceError, disabled, onAttachFile, onAttachUrl, onToggleVoice, onToggleQueue, onSend, }) {
    return (_jsxs("div", { className: "flex items-center justify-between gap-2 px-3 py-2", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx(ToolbarButton, { label: "Attach file", onClick: onAttachFile, disabled: disabled }), _jsx(ToolbarButton, { label: "Attach URL", onClick: onAttachUrl, disabled: disabled }), _jsx(VoiceRecorder, { recording: voiceRecording, elapsedMs: voiceElapsedMs, error: voiceError, disabled: disabled, onToggle: onToggleVoice }), _jsx(ToolbarButton, { label: queueMode ? 'Queue on' : 'Queue', active: queueMode, badge: queueCount > 0 ? String(queueCount) : undefined, onClick: onToggleQueue, disabled: disabled })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("span", { className: "text-[10px] text-zinc-600", children: [charCount, " chars"] }), _jsx("button", { type: "button", onClick: onSend, disabled: disabled, title: "Send (Enter). Ctrl+Enter also sends.", className: "rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-500 disabled:opacity-50", children: "Send" })] })] }));
}
function ToolbarButton({ label, onClick, disabled, active, badge, }) {
    return (_jsxs("button", { type: "button", onClick: onClick, disabled: disabled, className: `relative rounded-lg border px-2 py-1.5 text-xs ${active
            ? 'border-indigo-500 text-indigo-300'
            : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'} disabled:opacity-50`, children: [label, badge && (_jsx("span", { className: "absolute -right-1 -top-1 rounded-full bg-indigo-600 px-1 text-[10px] text-white", children: badge }))] }));
}
