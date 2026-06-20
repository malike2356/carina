import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { attachmentFromFile } from '../../lib/composer-types.js';
import { pickFile } from '../../lib/fs-dialogs.js';
import { useSlashCompletions } from '../../hooks/use-slash-completions.js';
import { useAtCompletions } from '../../hooks/use-at-completions.js';
import { useVoiceRecorder } from '../../hooks/use-voice-recorder.js';
import { useFileDropZone } from '../../hooks/use-file-drop-zone.js';
import ComposerInput from './ComposerInput.js';
import ComposerToolbar from './ComposerToolbar.js';
import SlashMenu from './SlashMenu.js';
import AtMenu from './AtMenu.js';
import AttachPanel from './AttachPanel.js';
import QueuePanel from './QueuePanel.js';
import ContextMenu from './ContextMenu.js';
import UrlDialog from './UrlDialog.js';
import DropOverlay from './DropOverlay.js';
import CodeModeComposer from './CodeModeComposer.js';
function draftKey(sessionId) {
    return `carina-draft-${sessionId}`;
}
function replaceTriggerText(text, trigger, replacement) {
    const pattern = new RegExp(`(.*(?:^|\\s))${trigger}[^\\s]*$`);
    const match = text.match(pattern);
    if (!match)
        return `${text}${replacement} `;
    return `${match[1]}${replacement} `;
}
export default function Composer({ sessionId, onSubmit, disabled }) {
    const [text, setText] = useState('');
    const [attachments, setAttachments] = useState([]);
    const [queuedMessages, setQueuedMessages] = useState([]);
    const [queueMode, setQueueMode] = useState(false);
    const [slashQuery, setSlashQuery] = useState(null);
    const [atQuery, setAtQuery] = useState(null);
    const [urlDialogOpen, setUrlDialogOpen] = useState(false);
    const [contextMenu, setContextMenu] = useState(null);
    const [voiceEnabled, setVoiceEnabled] = useState(true);
    const [codeMode, setCodeMode] = useState(false);
    const [codeLanguage, setCodeLanguage] = useState(undefined);
    const [codeSeed, setCodeSeed] = useState('');
    const slash = useSlashCompletions(slashQuery ?? '');
    const at = useAtCompletions(atQuery ?? '');
    const voice = useVoiceRecorder();
    const addAttachments = useCallback((items) => {
        setAttachments((current) => [...current, ...items]);
    }, []);
    const { hovering } = useFileDropZone(addAttachments);
    useEffect(() => {
        const saved = localStorage.getItem(draftKey(sessionId));
        setText(saved ?? '');
        setAttachments([]);
        setQueuedMessages([]);
        setSlashQuery(null);
        setAtQuery(null);
        setCodeMode(false);
    }, [sessionId]);
    useEffect(() => {
        localStorage.setItem(draftKey(sessionId), text);
    }, [sessionId, text]);
    const canSend = useMemo(() => Boolean(text.trim() || attachments.length > 0), [attachments.length, text]);
    const handleSend = useCallback(() => {
        if (disabled || !canSend)
            return;
        if (queueMode) {
            setQueuedMessages((current) => [...current, text.trim()]);
            setText('');
            setAttachments([]);
            setSlashQuery(null);
            setAtQuery(null);
            return;
        }
        onSubmit(text, attachments);
        setText('');
        setAttachments([]);
        localStorage.removeItem(draftKey(sessionId));
        setSlashQuery(null);
        setAtQuery(null);
    }, [attachments, canSend, disabled, onSubmit, queueMode, sessionId, text]);
    useEffect(() => {
        function onKeyDown(event) {
            if (event.key === 'Escape') {
                setSlashQuery(null);
                setAtQuery(null);
                setContextMenu(null);
            }
            if (event.ctrlKey && event.key === '/') {
                event.preventDefault();
                setSlashQuery('');
            }
            if (event.ctrlKey && (event.key === 'q' || event.key === 'Q')) {
                event.preventDefault();
                setQueueMode((value) => !value);
            }
            if (event.ctrlKey && (event.key === 'm' || event.key === 'M')) {
                event.preventDefault();
                setVoiceEnabled((value) => !value);
            }
            if (event.ctrlKey && event.key === 'Enter') {
                event.preventDefault();
                handleSend();
            }
            if (event.ctrlKey && event.key === '`') {
                event.preventDefault();
                setCodeMode((value) => !value);
            }
        }
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [handleSend]);
    async function handleSendAll() {
        const pending = [...queuedMessages];
        if (text.trim())
            pending.push(text.trim());
        if (pending.length === 0 && attachments.length === 0)
            return;
        setQueuedMessages([]);
        setText('');
        const firstAttachments = attachments;
        setAttachments([]);
        for (let index = 0; index < pending.length; index += 1) {
            onSubmit(pending[index], index === 0 ? firstAttachments : []);
            if (index < pending.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, 500));
            }
        }
    }
    function handleSlashSelect(command) {
        setText((current) => replaceTriggerText(current, '/', command.trigger));
        setSlashQuery(null);
    }
    function handleAtSelect(target) {
        setText((current) => replaceTriggerText(current, '@', `@${target.name}`));
        setAtQuery(null);
    }
    async function handleAttachFile() {
        const selected = await pickFile({ multiple: true });
        if (!selected)
            return;
        const paths = Array.isArray(selected) ? selected : [selected];
        addAttachments(paths.map((path) => {
            const name = String(path).split(/[/\\]/).pop() ?? String(path);
            return attachmentFromFile(new File([], name), String(path));
        }));
    }
    async function handleToggleVoice() {
        if (!voiceEnabled)
            return;
        const transcript = await voice.toggleRecording();
        if (transcript) {
            setText((current) => (current ? `${current} ${transcript}` : transcript));
        }
    }
    function handleTextChange(next) {
        setText(next);
        const fenceMatch = next.match(/```(\w+)?\n?$/);
        if (fenceMatch) {
            setCodeLanguage(fenceMatch[1]);
            setCodeSeed('');
            setCodeMode(true);
            setText(next.replace(/```(\w+)?\n?$/, ''));
        }
    }
    if (codeMode) {
        return (_jsx(CodeModeComposer, { initialCode: codeSeed, initialLanguage: codeLanguage, disabled: disabled, onCancel: () => setCodeMode(false), onSubmit: (content) => {
                setCodeMode(false);
                onSubmit(content, attachments);
                setText('');
                setAttachments([]);
                localStorage.removeItem(draftKey(sessionId));
            } }));
    }
    return (_jsxs("div", { className: "relative border-t border-zinc-800 bg-zinc-950 flex-shrink-0", children: [_jsx(DropOverlay, { visible: hovering }), _jsx(QueuePanel, { queue: queuedMessages, onEdit: (index, value) => {
                    setQueuedMessages((current) => current.map((item, i) => (i === index ? value : item)));
                }, onRemove: (index) => {
                    setQueuedMessages((current) => current.filter((_, i) => i !== index));
                }, onReorder: (from, to) => {
                    setQueuedMessages((current) => {
                        const next = [...current];
                        const [moved] = next.splice(from, 1);
                        next.splice(to, 0, moved);
                        return next;
                    });
                }, onSendAll: () => void handleSendAll(), onClear: () => setQueuedMessages([]) }), _jsx(AttachPanel, { attachments: attachments, onRemove: (id) => setAttachments((current) => current.filter((item) => item.id !== id)) }), _jsxs("div", { className: "relative", children: [slashQuery !== null && (_jsx(SlashMenu, { query: slashQuery, commands: slash.commands, onSelect: handleSlashSelect, onClose: () => setSlashQuery(null) })), atQuery !== null && (_jsx(AtMenu, { query: atQuery, targets: at.targets, onSelect: handleAtSelect, onClose: () => setAtQuery(null) })), _jsx(ComposerInput, { value: text, disabled: disabled, onChange: handleTextChange, onSubmit: handleSend, onSlashQuery: setSlashQuery, onAtQuery: setAtQuery, onContextMenu: (x, y) => setContextMenu({ x, y }), onPasteFiles: (files) => addAttachments(files.map((file) => attachmentFromFile(file))) })] }), _jsx(ComposerToolbar, { charCount: text.length, queueCount: queuedMessages.length, queueMode: queueMode, voiceRecording: voice.recording, voiceElapsedMs: voice.elapsedMs, voiceError: voice.error, disabled: disabled, onAttachFile: () => void handleAttachFile(), onAttachUrl: () => setUrlDialogOpen(true), onToggleVoice: () => void handleToggleVoice(), onToggleQueue: () => setQueueMode((value) => !value), onSend: handleSend }), _jsx(UrlDialog, { open: urlDialogOpen, onClose: () => setUrlDialogOpen(false), onAdd: (attachment) => addAttachments([attachment]) }), contextMenu && (_jsx(ContextMenu, { x: contextMenu.x, y: contextMenu.y, onClose: () => setContextMenu(null), onCut: () => document.execCommand('cut'), onCopy: () => document.execCommand('copy'), onPaste: async () => {
                    const clip = await navigator.clipboard.readText().catch(() => '');
                    if (clip) {
                        setText((current) => `${current}${clip}`);
                    }
                }, onClearDraft: () => {
                    setText('');
                    localStorage.removeItem(draftKey(sessionId));
                }, onToggleQueue: () => setQueueMode((value) => !value), onToggleVoice: () => setVoiceEnabled((value) => !value) }))] }));
}
