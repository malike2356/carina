'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BrandMark } from '@/components/shell/BrandMark';
import { authClient } from '@/lib/auth-client';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { GOOGLE_AUTH_COMPLETE_PATH, primeGoogleSignupCookies } from '@/lib/google-auth-flow';
import {
  buildAivaProvisionPath,
  buildAivaProvisionLoginPath,
  provisionIntentFromSearchParams,
  setClientProvisionIntentCookies,
} from '@/lib/aiva-role-provision-links';
import {
  buildPromoOnboardingPath,
  promoFromSearchParams,
  setClientSignupRefCookie,
} from '@/lib/aiva-signup-promo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { useBrand } from '@/components/shell/BrandProvider';
import { useIsAivaProduct } from '@/hooks/useProductSurface';
import { TERMS_VERSION } from '@/lib/gdpr-constants';

type RegisterFormProps = {
  googleAuthEnabled: boolean;
};

function RegisterFormInner({ googleAuthEnabled }: RegisterFormProps) {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const brand = useBrand();
  const searchParams = useSearchParams();
  const isAivaProduct = useIsAivaProduct();
  const fromAiva = isAivaProduct || searchParams.get('from') === 'aiva';
  const provisionIntent = provisionIntentFromSearchParams(searchParams);
  const signupPromo = promoFromSearchParams(searchParams);
  const provisionPath = provisionIntent.intent
    ? buildAivaProvisionPath({
        description: provisionIntent.description,
        role: provisionIntent.role,
      })
    : null;
  const loginHref = provisionIntent.intent
    ? buildAivaProvisionLoginPath({
        description: provisionIntent.description,
        role: provisionIntent.role,
      })
    : '/login';

  useEffect(() => {
    if (signupPromo) setClientSignupRefCookie(signupPromo.code);
  }, [signupPromo]);

  useEffect(() => {
    if (!provisionIntent.intent) return;
    setClientProvisionIntentCookies(provisionIntent.description);
  }, [provisionIntent.description, provisionIntent.intent]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError('');
    setStatus(fromAiva ? 'Creating account and setting up your trial...' : 'Creating account...');
    const formData = new FormData(e.currentTarget);
    const name = String(formData.get('name'));
    const email = String(formData.get('email'));
    const password = String(formData.get('password'));
    const termsAcceptedForm = formData.get('terms_accepted') === 'on';
    if (!termsAcceptedForm) {
      setError('You must accept the Terms of Service and Privacy Policy.');
      setPending(false);
      return;
    }
    const username = email.split('@')[0];
    const result = await authClient.signUp.email({
      name,
      email,
      password,
      username,
      termsAcceptedAt: new Date(),
      termsVersion: TERMS_VERSION,
    } as Parameters<typeof authClient.signUp.email>[0]);
    if (result.error) {
      setError(result.error.message ?? 'Registration failed');
      setPending(false);
      setStatus('');
      return;
    }

    if (fromAiva) {
      setStatus('Trial ready. Opening onboarding...');
      document.cookie = 'aiva_signup_pending=1; path=/; max-age=2592000; samesite=lax';
      await new Promise((resolve) => window.setTimeout(resolve, 700));
      if (provisionPath) {
        setClientProvisionIntentCookies(provisionIntent.description);
        window.location.href = provisionPath;
        return;
      }
      window.location.href = signupPromo
        ? buildPromoOnboardingPath(signupPromo.code)
        : '/onboarding';
      return;
    }

    window.location.href = '/launcher';
  }

  function primeGoogleSignup() {
    if (!termsAccepted) {
      setError('You must accept the Terms of Service and Privacy Policy before continuing with Google.');
      throw new Error('terms');
    }
    primeGoogleSignupCookies({
      termsAccepted: true,
      aivaTrial: Boolean(fromAiva),
      returnTo: signupPromo
        ? buildPromoOnboardingPath(signupPromo.code)
        : provisionPath ?? undefined,
      signupRef: signupPromo?.code,
    });
    if (signupPromo) setClientSignupRefCookie(signupPromo.code);
    if (provisionIntent.intent) {
      setClientProvisionIntentCookies(provisionIntent.description);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <div>
        <BrandMark className="mb-4" nameClassName="text-lg font-semibold text-text-primary" size={36} />
        <h1 className="text-2xl font-semibold">Create your {brand.productName} account</h1>
        <p className="text-sm text-text-secondary">
          {signupPromo
            ? `Free ${signupPromo.trialDays}-day trial with ${signupPromo.trialMessages} messages included. No card required.`
            : fromAiva
              ? 'One step. 30-day free trial. No card and no plan commitment.'
              : 'Free tier includes 50k tokens per day with BYOK.'}
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-surface p-6">
        {fromAiva ? <input type="hidden" name="from" value="aiva" /> : null}

        <label className="flex items-start gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            name="terms_accepted"
            className="mt-1"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
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

        {googleAuthEnabled ? (
          <>
            <p className="rounded-lg border border-border bg-elevated px-3 py-2 text-xs text-text-secondary">
              Google Sign-In is invite-only while we finish Google verification.
              Prefer email signup below if Google shows Access blocked (403).
              Already have an account? Use Sign in with email instead.
            </p>
            <GoogleSignInButton
              callbackURL={GOOGLE_AUTH_COMPLETE_PATH}
              label="Continue with Google"
              disabled={!termsAccepted}
              onBeforeRedirect={primeGoogleSignup}
            />
            <p className="text-center text-xs uppercase tracking-wide text-text-muted">or create with email</p>
          </>
        ) : null}

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
        {fromAiva ? (
          <p className="rounded-lg border border-border bg-elevated px-3 py-2 text-xs text-text-secondary">
            {signupPromo
              ? 'After signup you meet your property assistant and get a sample daily summary straight away.'
              : 'After signup you land in onboarding on a free trial. Paid plans stay optional until you choose one.'}
          </p>
        ) : null}
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Creating account...' : fromAiva ? 'Start free trial' : 'Create account'}
        </Button>
        {status ? <p className="text-sm text-text-secondary">{status}</p> : null}
      </form>
      <p className="text-sm text-text-secondary">
        Already registered? <Link href={loginHref} className="font-medium text-accent">Sign in</Link>
      </p>
    </main>
  );
}

export default function RegisterForm({ googleAuthEnabled }: RegisterFormProps) {
  return (
    <Suspense fallback={<main className="min-h-screen bg-base" />}>
      <RegisterFormInner googleAuthEnabled={googleAuthEnabled} />
    </Suspense>
  );
}
