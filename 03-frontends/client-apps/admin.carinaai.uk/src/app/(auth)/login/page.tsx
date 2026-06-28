'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');
  const [rateLimited, setRateLimited] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setRateLimited(false);

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get('email'));
    const password = String(formData.get('password'));

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (res.status === 429) {
      setRateLimited(true);
      setLoading(false);
      return;
    }

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string; step?: string };
      setError(body.error ?? 'Invalid credentials');
      setLoading(false);
      return;
    }

    const body = (await res.json()) as { step?: string };
    if (body.step === 'totp_setup') {
      router.push('/totp-setup');
      return;
    }
    if (body.step === 'totp_verify') {
      router.push('/totp-verify');
      return;
    }

    const callbackUrl = searchParams.get('callbackUrl');
    router.push(callbackUrl && callbackUrl.startsWith('/') ? callbackUrl : '/customers');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-xs font-medium text-text-secondary">
          Email
        </label>
        <input id="email" name="email" type="email" required autoFocus className="admin-input" />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-xs font-medium text-text-secondary">
          Password
        </label>
        <input id="password" name="password" type="password" required className="admin-input" />
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {rateLimited ? (
        <p className="text-center text-sm text-danger">Too many attempts. Wait 15 minutes.</p>
      ) : (
        <button type="submit" disabled={loading} className="btn-admin-primary w-full">
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      )}
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-base">
      <div className="w-full max-w-sm rounded-xl border border-border bg-elevated p-8">
        <div className="mb-6">
          <p className="text-xs font-semibold tracking-widest text-text-primary">VERLOX</p>
          <p className="mt-1 text-sm text-text-muted">Admin access</p>
        </div>
        <Suspense fallback={<p className="text-sm text-text-muted">Loading...</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
