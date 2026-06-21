import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  generatePairingToken,
  getPairedDevices,
  revokePairedDevice,
  type PairedDevice,
  type PairingToken,
} from '../../../lib/gateway-client.js';

export default function DevicesSettingsPage() {
  const [devices, setDevices] = useState<PairedDevice[]>([]);
  const [pairing, setPairing] = useState<PairingToken | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  async function refreshDevices() {
    setDevices(await getPairedDevices());
  }

  useEffect(() => {
    void refreshDevices();
  }, []);

  useEffect(() => {
    if (!pairing) return;
    const tick = () => {
      const left = Math.max(0, Math.floor((new Date(pairing.expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) setPairing(null);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pairing unavailable');
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <section className="rounded-xl border border-zinc-800 p-4">
        <h2 className="text-sm font-semibold text-zinc-100">Link mobile device</h2>
        <p className="text-xs text-zinc-500 mt-1">Scan with the Carina mobile app while on the same network.</p>
        <button type="button" onClick={() => void handleGenerateQr()} className="mt-3 text-xs bg-indigo-600 text-white rounded px-3 py-1.5">
          Generate QR code
        </button>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        {pairing && (
          <div className="mt-4 flex items-start gap-4">
            {qrDataUrl && <img src={qrDataUrl} alt="Pairing QR code" className="rounded-lg border border-zinc-700" />}
            <div className="text-xs text-zinc-400 space-y-1">
              <p>Expires in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</p>
              <p className="break-all">{pairing.uri}</p>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-zinc-100 mb-2">Paired devices</h2>
        {devices.length === 0 ? (
          <p className="text-sm text-zinc-500">No paired devices yet.</p>
        ) : (
          <div className="space-y-2">
            {devices.map((device) => (
              <div key={device.id} className="rounded-lg border border-zinc-800 p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-100">{device.name}</p>
                  <p className="text-xs text-zinc-500">
                    {device.platform} | paired {new Date(device.pairedAt).toLocaleDateString()}
                    {device.lastSeenAt ? ` | last seen ${new Date(device.lastSeenAt).toLocaleString()}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void revokePairedDevice(device.id).then(refreshDevices)}
                  className="text-xs text-red-400 border border-red-800 rounded px-2 py-1"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
