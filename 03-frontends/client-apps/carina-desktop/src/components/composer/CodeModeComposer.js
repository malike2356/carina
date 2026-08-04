import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { lspRequest } from '../../lib/gateway-client.js';
const LANGUAGES = [
    'typescript',
    'javascript',
    'python',
    'rust',
    'go',
    'json',
    'markdown',
    'html',
    'css',
    'shell',
];
function detectLanguage(code, hint) {
    if (hint && LANGUAGES.includes(hint))
        return hint;
    const firstLine = code.split('\n')[0]?.trim() ?? '';
    if (firstLine.includes('fn main') || firstLine.startsWith('use '))
        return 'rust';
    if (firstLine.startsWith('def ') || firstLine.startsWith('import '))
        return 'python';
    if (firstLine.startsWith('package ') || firstLine.startsWith('func '))
        return 'go';
    if (firstLine.startsWith('#!'))
        return 'shell';
    return 'typescript';
}
function wrapForSubmit(language, code) {
    return `\`\`\`${language}\n${code.replace(/\n$/, '')}\n\`\`\``;
}
export default function CodeModeComposer({ initialCode = '', initialLanguage, disabled, onCancel, onSubmit, }) {
    const [code, setCode] = useState(initialCode);
    const [language, setLanguage] = useState(() => detectLanguage(initialCode, initialLanguage));
    const editorRef = useRef(null);
    const monacoRef = useRef(null);
    const versionRef = useRef(0);
    const sessionKey = useMemo(() => `desktop-code-${Date.now()}`, []);
    const documentUri = useMemo(() => `file:///carina-desktop/composer.${language}`, [language]);
    const syncChange = useCallback(async (nextCode) => {
        versionRef.current += 1;
        await lspRequest('textDocument/didChange', {
            textDocument: { uri: documentUri, version: versionRef.current },
            contentChanges: [{ text: nextCode }],
        }, { sessionKey, language });
    }, [documentUri, language, sessionKey]);
    useEffect(() => {
        void (async () => {
            await lspRequest('textDocument/didOpen', {
                textDocument: { uri: documentUri, languageId: language, version: 1 },
                text: code,
            }, { sessionKey, language });
        })();
        return () => {
            void lspRequest('textDocument/didClose', {
                textDocument: { uri: documentUri },
            }, { sessionKey, language });
            void lspRequest('shutdown', {}, { sessionKey, language });
        };
    }, [code, documentUri, language, sessionKey]);
    function wireProviders(monaco, editor) {
        monacoRef.current = monaco;
        editorRef.current = editor;
        monaco.languages.registerCompletionItemProvider(language, {
            triggerCharacters: ['.', ':', '<', '"', '/', '@'],
            provideCompletionItems: async (_model, position) => {
                const items = await lspRequest('textDocument/completion', {
                    textDocument: { uri: documentUri },
                    position: { line: position.lineNumber - 1, character: position.column - 1 },
                }, { sessionKey, language });
                const list = Array.isArray(items) ? items : (items?.items ?? []);
                return {
                    suggestions: list.map((item, index) => ({
                        label: typeof item.label === 'string' ? item.label : String(item.label),
                        kind: item.kind ?? monaco.languages.CompletionItemKind.Text,
                        insertText: typeof item.insertText === 'string'
                            ? item.insertText
                            : item.label,
                        range: {
                            startLineNumber: position.lineNumber,
                            endLineNumber: position.lineNumber,
                            startColumn: position.column,
                            endColumn: position.column,
                        },
                        sortText: String(index).padStart(4, '0'),
                    })),
                };
            },
        });
        monaco.languages.registerHoverProvider(language, {
            provideHover: async (_model, position) => {
                const result = await lspRequest('textDocument/hover', {
                    textDocument: { uri: documentUri },
                    position: { line: position.lineNumber - 1, character: position.column - 1 },
                }, { sessionKey, language });
                const value = Array.isArray(result?.contents)
                    ? result.contents.map((part) => (typeof part === 'string' ? part : part.value)).join('\n')
                    : '';
                if (!value)
                    return null;
                return {
                    range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                    contents: [{ value }],
                };
            },
        });
    }
    useEffect(() => {
        function onKeyDown(event) {
            if (event.ctrlKey && event.key === '`') {
                event.preventDefault();
                onCancel();
            }
            if (event.ctrlKey && event.key === 'Enter') {
                event.preventDefault();
                if (!disabled)
                    onSubmit(wrapForSubmit(language, code));
            }
        }
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [code, disabled, language, onCancel, onSubmit]);
    return (_jsxs("div", { className: "border-t border-zinc-800 bg-zinc-950", children: [_jsxs("div", { className: "flex items-center gap-2 px-3 py-2 border-b border-zinc-800", children: [_jsx("span", { className: "text-xs text-zinc-500", children: "Code mode" }), _jsx("select", { value: language, onChange: (event) => setLanguage(event.target.value), className: "ml-2 text-xs bg-zinc-900 border border-zinc-700 rounded px-2 py-1", children: LANGUAGES.map((item) => (_jsx("option", { value: item, children: item }, item))) }), _jsxs("div", { className: "ml-auto flex gap-2", children: [_jsx("button", { type: "button", onClick: onCancel, className: "text-xs border border-zinc-700 rounded px-2 py-1 text-zinc-300", children: "Exit (Ctrl+`)" }), _jsx("button", { type: "button", disabled: disabled, onClick: () => onSubmit(wrapForSubmit(language, code)), className: "text-xs bg-indigo-600 text-white rounded px-2 py-1 disabled:opacity-50", children: "Send (Ctrl+Enter)" })] })] }), _jsx("div", { className: "h-56", children: _jsx(Editor, { language: language, theme: "vs-dark", value: code, onChange: (value) => {
                        const next = value ?? '';
                        setCode(next);
                        void syncChange(next);
                    }, onMount: (editor, monaco) => wireProviders(monaco, editor), options: {
                        minimap: { enabled: false },
                        fontSize: 13,
                        wordWrap: 'on',
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                    } }) })] }));
}
