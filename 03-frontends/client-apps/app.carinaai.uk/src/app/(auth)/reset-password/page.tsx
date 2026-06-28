'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BrandMark } from '@/components/shell/BrandMark';
import { useBrand } from '@/components/shell/BrandProvider';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const linkError = searchParams.get('error');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const brand = useBrand();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) {
      setError('This reset link is invalid or has expired.');
      return;
    }

    setPending(true);
    setError('');
    const formData = new FormData(e.currentTarget);
    const password = String(formData.get('password'));
    const confirm = String(formData.get('confirm'));

    if (password.length < 10) {
      setError('Password must be at least 10 characters.');
      setPending(false);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      setPending(false);
      return;
    }

    const result = await authClient.resetPassword({
      newPassword: password,
      token,
    });

    if (result.error) {
      setError(result.error.message ?? 'Could not reset password');
      setPending(false);
      return;
    }

    setDone(true);
    setPending(false);
  }

  if (linkError === 'INVALID_TOKEN' || (!token && !done)) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
        <div>
          <BrandMark className="mb-4" nameClassName="text-lg font-semibold text-text-primary" size={36} />
          <h1 className="text-2xl font-semibold">Reset link expired</h1>
          <p className="text-sm text-text-secondary">
            Request a new password reset link for your {brand.productName} account.
          </p>
        </div>
        <Link href="/forgot-password" className="font-medium text-accent">
          Request a new link
        </Link>
      </main>
    );
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
        <div>
          <BrandMark className="mb-4" nameClassName="text-lg font-semibold text-text-primary" size={36} />
          <h1 className="text-2xl font-semibold">Password updated</h1>
          <p className="text-sm text-text-secondary">You can now sign in with your new password.</p>
        </div>
        <Link href="/login" className="font-medium text-accent">
          Go to sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <div>
        <BrandMark className="mb-4" nameClassName="text-lg font-semibold text-text-primary" size={36} />
        <h1 className="text-2xl font-semibold">Choose a new password</h1>
        <p className="text-sm text-text-secondary">Use at least 10 characters for your {brand.productName} account.</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-surface p-6">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" minLength={10} autoComplete="new-password" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input id="confirm" name="confirm" type="password" minLength={10} autoComplete="new-password" required />
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Updating password...' : 'Update password'}
        </Button>
      </form>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-base" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
