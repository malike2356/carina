'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function TotpVerifyPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/totp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (res.status === 429) {
      setError('Too many attempts. Sign in again.');
      setLoading(false);
      return;
    }
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
        <h1 className="text-lg font-semibold text-text-primary">Two-factor authentication</h1>
        <p className="mt-2 text-sm text-text-muted">Enter the 6-digit code from your authenticator app.</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="code" className="mb-1 block text-xs font-medium text-text-secondary">
              Authentication code
            </label>
            <input
              id="code"
              name="code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              className="admin-input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <button type="submit" disabled={loading} className="btn-admin-primary w-full">
            {loading ? 'Verifying...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
