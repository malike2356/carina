import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Outlet, NavLink } from 'react-router-dom';
import { ROUTES } from '../../lib/router-paths.js';
const SETTINGS_LINKS = [
    { to: ROUTES.settingsModels, label: 'Models and Providers' },
    { to: ROUTES.settingsChannels, label: 'Channels' },
    { to: ROUTES.settingsAppearance, label: 'Appearance' },
    { to: ROUTES.settingsDevices, label: 'Devices' },
    { to: ROUTES.settingsAbout, label: 'About' },
];
export default function SettingsLayout() {
    return (_jsxs("div", { className: "flex flex-1 overflow-hidden", children: [_jsxs("aside", { className: "w-56 border-r border-zinc-800 p-3 space-y-1", children: [_jsx("h1", { className: "text-sm font-semibold text-zinc-100 px-2 mb-2", children: "Settings" }), SETTINGS_LINKS.map((link) => (_jsx(NavLink, { to: link.to, className: ({ isActive }) => `block px-3 py-2 rounded text-sm ${isActive ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-900'}`, children: link.label }, link.to)))] }), _jsx("div", { className: "flex-1 overflow-y-auto p-4", children: _jsx(Outlet, {}) })] }));
}
