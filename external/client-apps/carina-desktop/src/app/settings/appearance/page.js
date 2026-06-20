import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { applyAppearance, DEFAULT_APPEARANCE, loadAppearance, saveAppearance, } from '../../../lib/appearance.js';
import { getAutostartEnabled, setAutostartEnabled } from '../../../lib/autostart.js';
const ACCENTS = ['#6366f1', '#22c55e', '#f97316', '#ec4899', '#06b6d4', '#eab308'];
export default function AppearanceSettingsPage() {
    const [settings, setSettings] = useState(DEFAULT_APPEARANCE);
    const [autostart, setAutostart] = useState(false);
    useEffect(() => {
        const loaded = loadAppearance();
        setSettings(loaded);
        applyAppearance(loaded);
        void getAutostartEnabled().then(setAutostart);
    }, []);
    function update(patch) {
        const next = { ...settings, ...patch };
        setSettings(next);
        saveAppearance(next);
        applyAppearance(next);
    }
    return (_jsxs("div", { className: "space-y-6 max-w-2xl", children: [_jsxs("section", { children: [_jsx("h2", { className: "text-sm font-semibold text-zinc-100 mb-2", children: "Theme" }), _jsx("div", { className: "flex gap-2", children: ['dark', 'light', 'system'].map((theme) => (_jsx("button", { type: "button", onClick: () => update({ theme }), className: `px-3 py-1.5 text-sm rounded ${settings.theme === theme ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-300'}`, children: theme }, theme))) })] }), _jsxs("section", { children: [_jsx("h2", { className: "text-sm font-semibold text-zinc-100 mb-2", children: "Font size" }), _jsx("div", { className: "flex gap-2", children: ['small', 'medium', 'large'].map((fontSize) => (_jsx("button", { type: "button", onClick: () => update({ fontSize }), className: `px-3 py-1.5 text-sm rounded ${settings.fontSize === fontSize ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-300'}`, children: fontSize }, fontSize))) })] }), _jsxs("section", { children: [_jsx("h2", { className: "text-sm font-semibold text-zinc-100 mb-2", children: "Density" }), _jsx("div", { className: "flex gap-2", children: ['compact', 'comfortable', 'spacious'].map((density) => (_jsx("button", { type: "button", onClick: () => update({ density }), className: `px-3 py-1.5 text-sm rounded ${settings.density === density ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-300'}`, children: density }, density))) })] }), _jsxs("section", { children: [_jsx("h2", { className: "text-sm font-semibold text-zinc-100 mb-2", children: "Accent color" }), _jsx("div", { className: "flex gap-2", children: ACCENTS.map((accent) => (_jsx("button", { type: "button", onClick: () => update({ accent }), className: "h-8 w-8 rounded-full border border-zinc-700", style: { backgroundColor: accent }, "aria-label": accent }, accent))) })] }), _jsxs("section", { children: [_jsx("h2", { className: "text-sm font-semibold text-zinc-100 mb-2", children: "Launch at login" }), _jsxs("label", { className: "flex items-center gap-2 text-sm text-zinc-300", children: [_jsx("input", { type: "checkbox", checked: autostart, onChange: (event) => {
                                    const next = event.target.checked;
                                    setAutostart(next);
                                    void setAutostartEnabled(next);
                                } }), "Start Carina when you sign in"] })] }), _jsxs("section", { children: [_jsx("h2", { className: "text-sm font-semibold text-zinc-100 mb-2", children: "Message timestamps" }), _jsxs("select", { value: settings.timestamps, onChange: (e) => update({ timestamps: e.target.value }), className: "px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg", children: [_jsx("option", { value: "relative", children: "Relative" }), _jsx("option", { value: "absolute", children: "Absolute" }), _jsx("option", { value: "hidden", children: "Hidden" })] })] })] }));
}
