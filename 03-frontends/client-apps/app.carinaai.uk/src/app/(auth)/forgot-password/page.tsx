'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BrandMark } from '@/components/shell/BrandMark';
import { useBrand } from '@/components/shell/BrandProvider';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ForgotPasswordPage() {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const brand = useBrand();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError('');
    setMessage('');

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get('email'));
    const redirectTo = `${window.location.origin}/reset-password`;

    const result = await authClient.requestPasswordReset({
      email,
      redirectTo,
    });

    if (result.error) {
      setError(result.error.message ?? 'Could not send reset email');
      setPending(false);
      return;
    }

    setMessage('If this email exists in our system, check your inbox for a reset link.');
    setPending(false);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <div>
        <BrandMark className="mb-4" nameClassName="text-lg font-semibold text-text-primary" size={36} />
        <h1 className="text-2xl font-semibold">Reset your password</h1>
        <p className="text-sm text-text-secondary">
          Enter the email for your {brand.productName} account. We will send a secure reset link.
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-surface p-6">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {message ? <p className="text-sm text-accent">{message}</p> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Sending link...' : 'Send reset link'}
        </Button>
      </form>
      <p className="text-sm text-text-secondary">
        Remember your password?{' '}
        <Link href="/login" className="font-medium text-accent">
          Sign in
        </Link>
      </p>
    </main>
  );
}
