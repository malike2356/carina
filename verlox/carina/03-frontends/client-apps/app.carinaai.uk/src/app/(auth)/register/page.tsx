'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { BrandMark } from '@/components/shell/BrandMark';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { useState } from 'react';
import { useBrand } from '@/components/shell/BrandProvider';
import { useIsAivaProduct } from '@/hooks/useProductSurface';

function RegisterForm() {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const brand = useBrand();
  const searchParams = useSearchParams();
  const isAivaProduct = useIsAivaProduct();
  const fromAiva = isAivaProduct || searchParams.get('from') === 'aiva';

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError('');
    const formData = new FormData(e.currentTarget);
    const name = String(formData.get('name'));
    const email = String(formData.get('email'));
    const password = String(formData.get('password'));
    const termsAccepted = formData.get('terms_accepted') === 'on';
    if (!termsAccepted) {
      setError('You must accept the Terms of Service and Privacy Policy.');
      setPending(false);
      return;
    }
    const result = await authClient.signUp.email({ name, email, password });
    if (result.error) {
      setError(result.error.message ?? 'Registration failed');
      setPending(false);
      return;
    }
    void fetch('/api/auth/accept-terms', { method: 'POST' }).catch(() => {});

    if (fromAiva) {
      void fetch('/api/aiva/subscription/trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerEmail: email, ownerName: name }),
      }).catch(() => {});
      document.cookie = 'aiva_signup_pending=1; path=/; max-age=2592000; samesite=lax';
      window.location.href = '/onboarding';
      return;
    }

    window.location.href = '/launcher';
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <div>
        <BrandMark className="mb-4" nameClassName="text-lg font-semibold text-text-primary" size={36} />
        <h1 className="text-2xl font-semibold">Create your {brand.productName} account</h1>
        <p className="text-sm text-text-secondary">
          {fromAiva
            ? 'Hire an Aiva. Powered by Carina. Governed by Scout. Backed by real humans. 15-day trial, no card required.'
            : 'Free tier includes 50k tokens per day with BYOK.'}
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-surface p-6">
        {fromAiva ? <input type="hidden" name="from" value="aiva" /> : null}
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" type="text" autoComplete="name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" minLength={10} required />
        </div>
        <label className="flex items-start gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            name="terms_accepted"
            className="mt-1"
            required
          />
          <span>
            I agree to the{' '}
            <a href="/legal/terms" target="_blank" rel="noopener noreferrer" className="text-accent underline">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-accent underline">
              Privacy Policy
            </a>
          </span>
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Creating account...' : 'Create account'}
        </Button>
      </form>
      <p className="text-sm text-text-secondary">
        Already registered? <Link href="/login" className="font-medium text-accent">Sign in</Link>
      </p>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-base" />}>
      <RegisterForm />
    </Suspense>
  );
}
