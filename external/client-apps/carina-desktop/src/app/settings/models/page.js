import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { getProviders, saveProviderKey, switchProvider, testProviderKey } from '../../../lib/gateway-client.js';
const PROVIDERS = ['deepseek', 'anthropic', 'openai', 'gemini', 'groq'];
export default function ModelsSettingsPage() {
    const [active, setActive] = useState('');
    const [providers, setProviders] = useState([]);
    const [keys, setKeys] = useState({});
    const [status, setStatus] = useState({});
    const [temperature, setTemperature] = useState(0.7);
    const [maxTokens, setMaxTokens] = useState(4096);
    const [systemPrompt, setSystemPrompt] = useState('');
    useEffect(() => {
        void getProviders().then((data) => {
            setProviders(data.providers);
            setActive(data.active);
        });
        setSystemPrompt(localStorage.getItem('carina_system_prompt') ?? '');
    }, []);
    async function handleSwitch(provider) {
        await switchProvider(provider);
        setActive(provider);
    }
    async function handleTest(provider) {
        const result = await testProviderKey(provider, keys[provider] ?? '');
        setStatus((prev) => ({ ...prev, [provider]: result.ok ? 'Valid' : (result.message ?? 'Invalid') }));
    }
    async function handleSaveKey(provider) {
        await saveProviderKey(provider, keys[provider] ?? '');
        setStatus((prev) => ({ ...prev, [provider]: 'Saved via gateway' }));
    }
    return (_jsxs("div", { className: "space-y-6 max-w-2xl", children: [_jsxs("section", { children: [_jsx("h2", { className: "text-sm font-semibold text-zinc-100 mb-2", children: "Active model" }), _jsx("select", { value: active, onChange: (e) => void handleSwitch(e.target.value), className: "w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg", children: (providers.length ? providers : PROVIDERS).map((provider) => (_jsx("option", { value: provider, children: provider }, provider))) })] }), _jsxs("section", { children: [_jsx("h2", { className: "text-sm font-semibold text-zinc-100 mb-2", children: "Provider API keys" }), _jsx("div", { className: "space-y-3", children: PROVIDERS.map((provider) => (_jsxs("div", { className: "rounded-lg border border-zinc-800 p-3", children: [_jsx("label", { className: "text-xs uppercase tracking-wide text-zinc-500", children: provider }), _jsx("input", { type: "password", value: keys[provider] ?? '', onChange: (e) => setKeys((prev) => ({ ...prev, [provider]: e.target.value })), className: "mt-1 w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-700 rounded-lg", placeholder: "Stored via gateway" }), _jsxs("div", { className: "mt-2 flex gap-2", children: [_jsx("button", { type: "button", onClick: () => void handleTest(provider), className: "text-xs border border-zinc-700 rounded px-2 py-1", children: "Test" }), _jsx("button", { type: "button", onClick: () => void handleSaveKey(provider), className: "text-xs bg-indigo-600 text-white rounded px-2 py-1", children: "Save" }), _jsx("span", { className: "text-xs text-zinc-500 self-center", children: status[provider] })] })] }, provider))) })] }), _jsxs("section", { children: [_jsx("h2", { className: "text-sm font-semibold text-zinc-100 mb-2", children: "Model defaults" }), _jsxs("label", { className: "block text-xs text-zinc-500 mb-1", children: ["Temperature (", temperature, ")"] }), _jsx("input", { type: "range", min: 0, max: 1, step: 0.05, value: temperature, onChange: (e) => setTemperature(Number(e.target.value)), className: "w-full" }), _jsx("label", { className: "block text-xs text-zinc-500 mt-3 mb-1", children: "Max tokens" }), _jsx("input", { type: "number", value: maxTokens, onChange: (e) => setMaxTokens(Number(e.target.value)), className: "w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg" }), _jsx("label", { className: "block text-xs text-zinc-500 mt-3 mb-1", children: "System prompt" }), _jsx("textarea", { value: systemPrompt, onChange: (e) => {
                            setSystemPrompt(e.target.value);
                            localStorage.setItem('carina_system_prompt', e.target.value);
                        }, rows: 5, className: "w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg" })] })] }));
}
