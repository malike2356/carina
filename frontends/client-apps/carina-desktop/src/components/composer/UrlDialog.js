import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { fetchUrlMetadata } from '../../lib/gateway-client.js';
export default function UrlDialog({ open, onClose, onAdd }) {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    if (!open)
        return null;
    async function handleSubmit(event) {
        event.preventDefault();
        const trimmed = url.trim();
        if (!trimmed)
            return;
        setLoading(true);
        setError(null);
        try {
            const meta = await fetchUrlMetadata(trimmed);
            onAdd({
                kind: 'url',
                id: `url-${Date.now()}`,
                url: meta.url,
                title: meta.title,
                description: meta.description,
                favicon: meta.favicon,
            });
            setUrl('');
            onClose();
        }
        catch {
            setError('Could not fetch URL metadata');
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4", children: _jsxs("form", { onSubmit: (event) => void handleSubmit(event), className: "w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl", children: [_jsx("h2", { className: "text-sm font-semibold text-zinc-100", children: "Attach URL" }), _jsx("p", { className: "mt-1 text-xs text-zinc-400", children: "Paste a link to include as an attachment preview." }), _jsx("input", { value: url, onChange: (event) => setUrl(event.target.value), placeholder: "https://example.com", className: "mt-4 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100", autoFocus: true }), error && _jsx("p", { className: "mt-2 text-xs text-red-400", children: error }), _jsxs("div", { className: "mt-4 flex justify-end gap-2", children: [_jsx("button", { type: "button", onClick: onClose, className: "rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400", children: "Cancel" }), _jsx("button", { type: "submit", disabled: loading || !url.trim(), className: "rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-50", children: loading ? 'Fetching...' : 'Add URL' })] })] }) }));
}
