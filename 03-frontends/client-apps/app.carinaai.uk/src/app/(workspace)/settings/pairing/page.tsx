'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Trash2, Smartphone, Link2 } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/IconButton';
import { QRCodeCanvas } from '@/components/ui/QRCode';
import { cn } from '@/lib/utils';

interface PairingCodeResponse {
  code: string;
  expiresAt: string;
  expiresInMinutes: number;
}

interface PairingDevice {
  id: string;
  name: string;
  platform: string;
  pairedAt?: string;
  lastSeenAt?: string;
  lastSeen?: string;
  scopes?: string[];
}

function formatWhen(value?: string) {
  if (!value) return 'just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'just now';
  return date.toLocaleString();
}

export default function PairingPage() {
  const [code, setCode] = useState<PairingCodeResponse | null>(null);
  const [devices, setDevices] = useState<PairingDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qrValue = useMemo(() => {
    if (!code?.code) return '';
    return `carina://pair?code=${encodeURIComponent(code.code)}`;
  }, [code?.code]);

  async function load() {
    setRefreshing(true);
    setError(null);

    const [codeRes, devicesRes] = await Promise.all([
      fetch('/api/pairing/code', { method: 'POST' }),
      fetch('/api/pairing/devices'),
    ]);

    const codeData = await codeRes.json().catch(() => null);
    const devicesData = await devicesRes.json().catch(() => null);

    if (codeRes.ok && codeData?.data) {
      setCode(codeData.data as PairingCodeResponse);
    } else {
      setCode(null);
      setError(codeData?.error || 'Pairing code unavailable');
    }

    if (devicesRes.ok && Array.isArray(devicesData?.data)) {
      setDevices(devicesData.data as PairingDevice[]);
    } else if (devicesData?.error) {
      setError((current) => current ?? devicesData.error);
    }

    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function revokeDevice(id: string) {
    const res = await fetch(`/api/pairing/devices/${id}`, { method: 'DELETE' });
    if (!res.ok) return;
    setDevices((current) => current.filter((device) => device.id !== id));
  }

  return (
    <div className="flex w-full min-w-0 max-w-none flex-col gap-6 px-4 py-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Device pairing</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Create a pairing code, scan the QR on mobile, and review the devices that are already linked.
          </p>
        </div>
        <Button type="button" variant="ghost" onClick={() => void load()} disabled={refreshing}>
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-border bg-surface p-4 text-sm text-text-secondary">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <section className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-text-primary">Pair a device</h2>
          </div>
          <p className="mt-2 text-xs text-text-muted">
            Open the camera on the device you want to pair, then scan the QR or paste the code.
          </p>

          <div className="mt-4 flex justify-center rounded-lg border border-border bg-white p-4">
            {loading || !qrValue ? (
              <div className="flex h-48 w-48 items-center justify-center text-xs text-text-muted">
                {loading ? 'Generating code...' : 'No code available'}
              </div>
            ) : (
              <QRCodeCanvas value={qrValue} size={192} className="h-48 w-48" />
            )}
          </div>

          <div className="mt-4 space-y-2">
            <div className="rounded-lg border border-border bg-elevated px-3 py-2 text-xs text-text-secondary">
              <div className="mb-1 text-[10px] uppercase tracking-wide text-text-muted">Pairing code</div>
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-sm text-text-primary">{code?.code ?? 'Waiting...'}</span>
                <IconButton
                  label="Copy pairing code"
                  size="sm"
                  onClick={() => code?.code && navigator.clipboard.writeText(code.code).catch(() => {})}
                >
                  <Link2 className="h-3.5 w-3.5" />
                </IconButton>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-elevated px-3 py-2 text-xs text-text-secondary">
              Expires {code?.expiresAt ? formatWhen(code.expiresAt) : 'after the next refresh'}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold text-text-primary">Paired devices</h2>
          <p className="mt-1 text-xs text-text-muted">
            Remove old devices here. The same pairing backend is used by the core CLI.
          </p>

          {devices.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="No paired devices" subtitle="Pair a device to see it listed here." />
            </div>
          ) : (
            <div className="mt-4 divide-y divide-border rounded-lg border border-border">
              {devices.map((device) => (
                <div key={device.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm text-text-primary">{device.name}</p>
                    <p className="text-xs text-text-muted">
                      {device.platform} · last seen {formatWhen(device.lastSeenAt ?? device.lastSeen)}
                    </p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => void revokeDevice(device.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
