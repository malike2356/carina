import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { generatePairingToken, getPairedDevices, revokePairedDevice, } from '../../../lib/gateway-client.js';
export default function DevicesSettingsPage() {
    const [devices, setDevices] = useState([]);
    const [pairing, setPairing] = useState(null);
    const [qrDataUrl, setQrDataUrl] = useState('');
    const [error, setError] = useState(null);
    const [secondsLeft, setSecondsLeft] = useState(0);
    async function refreshDevices() {
        setDevices(await getPairedDevices());
    }
    useEffect(() => {
        void refreshDevices();
    }, []);
    useEffect(() => {
        if (!pairing)
            return;
        const tick = () => {
            const left = Math.max(0, Math.floor((new Date(pairing.expiresAt).getTime() - Date.now()) / 1000));
            setSecondsLeft(left);
            if (left === 0)
                setPairing(null);
        };
        tick();
        const timer = window.setInterval(tick, 1000);
        return () => window.clearInterval(timer);
    }, [pairing]);
    async function handleGenerateQr() {
        setError(null);
        try {
            const token = await generatePairingToken();
            setPairing(token);
            setQrDataUrl(await QRCode.toDataURL(token.uri, { margin: 1, width: 220 }));
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Pairing unavailable');
        }
    }
    return (_jsxs("div", { className: "space-y-6 max-w-2xl", children: [_jsxs("section", { className: "rounded-xl border border-zinc-800 p-4", children: [_jsx("h2", { className: "text-sm font-semibold text-zinc-100", children: "Link mobile device" }), _jsx("p", { className: "text-xs text-zinc-500 mt-1", children: "Scan with the Carina mobile app while on the same network." }), _jsx("button", { type: "button", onClick: () => void handleGenerateQr(), className: "mt-3 text-xs bg-indigo-600 text-white rounded px-3 py-1.5", children: "Generate QR code" }), error && _jsx("p", { className: "mt-2 text-xs text-red-400", children: error }), pairing && (_jsxs("div", { className: "mt-4 flex items-start gap-4", children: [qrDataUrl && _jsx("img", { src: qrDataUrl, alt: "Pairing QR code", className: "rounded-lg border border-zinc-700" }), _jsxs("div", { className: "text-xs text-zinc-400 space-y-1", children: [_jsxs("p", { children: ["Expires in ", Math.floor(secondsLeft / 60), ":", String(secondsLeft % 60).padStart(2, '0')] }), _jsx("p", { className: "break-all", children: pairing.uri })] })] }))] }), _jsxs("section", { children: [_jsx("h2", { className: "text-sm font-semibold text-zinc-100 mb-2", children: "Paired devices" }), devices.length === 0 ? (_jsx("p", { className: "text-sm text-zinc-500", children: "No paired devices yet." })) : (_jsx("div", { className: "space-y-2", children: devices.map((device) => (_jsxs("div", { className: "rounded-lg border border-zinc-800 p-3 flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm text-zinc-100", children: device.name }), _jsxs("p", { className: "text-xs text-zinc-500", children: [device.platform, " | paired ", new Date(device.pairedAt).toLocaleDateString(), device.lastSeenAt ? ` | last seen ${new Date(device.lastSeenAt).toLocaleString()}` : ''] })] }), _jsx("button", { type: "button", onClick: () => void revokePairedDevice(device.id).then(refreshDevices), className: "text-xs text-red-400 border border-red-800 rounded px-2 py-1", children: "Revoke" })] }, device.id))) }))] })] }));
}
