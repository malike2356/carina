'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BrandMark } from '@/components/shell/BrandMark';
import { useBrand } from '@/components/shell/BrandProvider';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function getCallbackUrl(): string {
  if (typeof window === 'undefined') return '/launcher';
  const value = new URLSearchParams(window.location.search).get('callbackUrl');
  return value && value.startsWith('/') ? value : '/launcher';
}

export default function LoginPage() {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const brand = useBrand();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError('');
    const formData = new FormData(e.currentTarget);
    const email = String(formData.get('email'));
    const password = String(formData.get('password'));
    const result = await authClient.signIn.email({ email, password });
    if (result.error) {
      const message = result.error.message ?? 'Sign in failed';
      setError(
        message.includes('Invalid email or password')
          ? `Invalid email or password. Use the password from when you registered on ${brand.productName}, or create a new account.`
          : message,
      );
      setPending(false);
      return;
    }
    window.location.href = getCallbackUrl();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <div>
        <BrandMark className="mb-4" nameClassName="text-lg font-semibold text-text-primary" size={36} />
        <h1 className="text-2xl font-semibold">Sign in to {brand.productName}</h1>
        <p className="text-sm text-text-secondary">Browser workspace with BYOK inference keys.</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-surface p-6">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" required />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
      <p className="text-sm text-text-secondary">
        No account yet?{' '}
        <Link href="/register" className="font-medium text-accent">
          Create one here
        </Link>
        {brand.supportEmail ? (
          <>
            . Need help? Contact{' '}
            <a href={`mailto:${brand.supportEmail}`} className="text-accent hover:underline">
              {brand.supportName ?? brand.supportEmail}
            </a>
          </>
        ) : null}
      </p>
    </main>
  );
}
