'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function TotpSetupPage() {
  const router = useRouter();
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetch('/api/auth/totp/qr')
      .then((res) => res.json())
      .then((data: { qrDataUrl?: string; email?: string; error?: string }) => {
        if (data.qrDataUrl) {
          setQrDataUrl(data.qrDataUrl);
          setEmail(String(data.email ?? ''));
        } else {
          router.replace('/login');
        }
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/totp/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? 'Invalid code');
      setLoading(false);
      return;
    }
    router.push('/customers');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-base">
      <div className="w-full max-w-sm rounded-xl border border-border bg-elevated p-8">
        <h1 className="text-lg font-semibold text-text-primary">Set up two-factor authentication</h1>
        <p className="mt-2 text-sm text-text-muted">
          Scan this QR code with your authenticator app for {email || 'your account'}.
        </p>
        {qrDataUrl ? (
          <Image
            src={qrDataUrl}
            alt="TOTP QR code"
            width={220}
            height={220}
            unoptimized
            className="mx-auto my-6 block rounded border border-border bg-white p-2"
          />
        ) : (
          <p className="my-6 text-sm text-text-muted">Loading QR code...</p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="code" className="mb-1 block text-xs font-medium text-text-secondary">
              6-digit code
            </label>
            <input
              id="code"
              name="code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              className="admin-input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <button type="submit" disabled={loading} className="btn-admin-primary w-full">
            {loading ? 'Verifying...' : 'Enable and continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
