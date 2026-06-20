import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
function detectTrigger(text, trigger) {
    const match = text.match(new RegExp(`(?:^|\\s)${trigger}([^\\s]*)$`));
    return match ? match[1] : null;
}
export default function ComposerInput({ value, disabled, onChange, onSubmit, onSlashQuery, onAtQuery, onContextMenu, onPasteFiles, }) {
    const editorRef = useRef(null);
    useEffect(() => {
        const editor = editorRef.current;
        if (!editor)
            return;
        if (editor.innerText !== value) {
            editor.innerText = value;
        }
    }, [value]);
    useEffect(() => {
        editorRef.current?.focus();
    }, []);
    function syncFromEditor() {
        const editor = editorRef.current;
        if (!editor)
            return;
        const next = editor.innerText.replace(/\u00a0/g, ' ').replace(/\n$/, '');
        onChange(next);
        onSlashQuery(detectTrigger(next, '/'));
        onAtQuery(detectTrigger(next, '@'));
    }
    function handleKeyDown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            onSubmit();
            return;
        }
        if (event.key === 'Enter' && event.shiftKey) {
            return;
        }
    }
    function handlePaste(event) {
        const files = Array.from(event.clipboardData.files ?? []);
        if (files.length > 0) {
            event.preventDefault();
            onPasteFiles(files);
            return;
        }
        event.preventDefault();
        const text = event.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
        syncFromEditor();
    }
    return (_jsxs("div", { className: "relative px-3 pb-2", children: [!value && (_jsx("div", { className: "pointer-events-none absolute left-3 top-2 text-sm text-zinc-600", children: "Message Carina... (/ for commands, @ to mention)" })), _jsx("div", { ref: editorRef, role: "textbox", "aria-multiline": "true", contentEditable: !disabled, suppressContentEditableWarning: true, onInput: syncFromEditor, onKeyDown: handleKeyDown, onPaste: handlePaste, onContextMenu: (event) => {
                    event.preventDefault();
                    onContextMenu(event.clientX, event.clientY);
                }, className: "min-h-[44px] max-h-[200px] overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500" })] }));
}
