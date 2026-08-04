'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BrandMark } from '@/components/shell/BrandMark';
import { useBrand } from '@/components/shell/BrandProvider';
import { useIsAivaProduct } from '@/hooks/useProductSurface';
import { authClient } from '@/lib/auth-client';
import { resolveAivaPostAuthPath } from '@/lib/aiva-post-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const CONSUMER_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'icloud.com',
  'me.com',
  'protonmail.com',
  'proton.me',
]);

function getCallbackUrl(isAivaProduct: boolean): string {
  if (typeof window === 'undefined') {
    return isAivaProduct ? resolveAivaPostAuthPath('/aiva') : '/launcher';
  }
  const value = new URLSearchParams(window.location.search).get('callbackUrl');
  if (isAivaProduct) return resolveAivaPostAuthPath(value);
  if (value && value.startsWith('/')) return value;
  return '/launcher';
}

interface SsoDiscovery {
  ssoAvailable: boolean;
  providerId?: string;
  providerType?: 'oidc' | 'saml';
  domain?: string;
  ssoRequired?: boolean;
}

export function LoginForm() {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState('');
  const [ssoDiscovery, setSsoDiscovery] = useState<SsoDiscovery | null>(null);
  const [ssoChecking, setSsoChecking] = useState(false);
  const [ownerPasswordMode, setOwnerPasswordMode] = useState(false);
  const [googleInviteBlocked, setGoogleInviteBlocked] = useState(false);
  const searchParams = useSearchParams();
  const brand = useBrand();
  const isAivaProduct = useIsAivaProduct();
  const returnTo = getCallbackUrl(isAivaProduct);

  useEffect(() => {
    const oauthError = (searchParams.get('error') ?? searchParams.get('error_description') ?? '').toLowerCase();
    const googleDenied =
      oauthError.includes('access_denied')
      || oauthError.includes('verification')
      || searchParams.get('google') === 'access_denied';
    if (isAivaProduct && googleDenied) {
      setGoogleInviteBlocked(true);
      setError(
        'Google Sign-In is on an invite list while we finish Google verification. '
        + 'Use email and password below, or ask the host to add your Gmail as a tester.',
      );
    }
  }, [isAivaProduct, searchParams]);

  async function checkSsoForEmail(value: string) {
    const trimmed = value.trim();
    const domain = trimmed.split('@')[1]?.toLowerCase();
    if (!trimmed.includes('@') || !domain || CONSUMER_EMAIL_DOMAINS.has(domain)) {
      setSsoDiscovery(null);
      return;
    }
    setSsoChecking(true);
    try {
      const res = await fetch('/api/auth/sso/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      if (!res.ok) {
        setSsoDiscovery(null);
        return;
      }
      const data = await res.json() as SsoDiscovery;
      setSsoDiscovery(data.ssoAvailable ? data : null);
      if (!data.ssoRequired) setOwnerPasswordMode(false);
    } catch {
      setSsoDiscovery(null);
    } finally {
      setSsoChecking(false);
    }
  }

  async function maybeDiscoverSso(emailValue: string) {
    const domain = emailValue.trim().split('@')[1]?.toLowerCase();
    if (!domain || CONSUMER_EMAIL_DOMAINS.has(domain)) {
      setSsoDiscovery(null);
      return;
    }
    await checkSsoForEmail(emailValue);
  }

  function startSso() {
    if (!ssoDiscovery?.providerId) return;
    const base = ssoDiscovery.providerType === 'saml'
      ? '/api/auth/sso/saml/authorize'
      : '/api/auth/sso/authorize';
    const url = new URL(base, window.location.origin);
    url.searchParams.set('providerId', ssoDiscovery.providerId);
    url.searchParams.set('returnTo', returnTo);
    window.location.href = url.toString();
  }

  const passwordBlocked = Boolean(ssoDiscovery?.ssoRequired) && !ownerPasswordMode;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (passwordBlocked) {
      setError('This domain requires SSO. Use Continue with SSO, or use owner password fallback below.');
      return;
    }
    setPending(true);
    setError('');
    const formData = new FormData(e.currentTarget);
    const formEmail = String(formData.get('email'));
    const password = String(formData.get('password'));
    await maybeDiscoverSso(formEmail);
    const result = await authClient.signIn.email({ email: formEmail, password });
    if (result.error) {
      const message = result.error.message ?? 'Sign in failed';
      setError(
        message.toLowerCase().includes('too many')
          || message.includes('429')
          ? 'Too many sign-in attempts. Wait one minute, then try again.'
          : message.includes('Invalid email or password')
          ? `Invalid email or password. Use the password from when you registered on ${brand.productName}, or create a new account.`
          : message,
      );
      setPending(false);
      return;
    }

    if (isAivaProduct) {
      try {
        const boot = await fetch('/api/workspace/onboarding-resume', {
          method: 'POST',
          credentials: 'include',
        });
        if (boot.ok) {
          const data = (await boot.json()) as { redirectTo?: string };
          window.location.href = data.redirectTo ?? returnTo;
          return;
        }
      } catch {
        // Fall back to the default post-auth path.
      }
    }

    window.location.href = returnTo;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <div>
        <BrandMark className="mb-4" nameClassName="text-lg font-semibold text-text-primary" size={36} />
        <h1 className="text-2xl font-semibold">Sign in to {brand.productName}</h1>
        <p className="text-sm text-text-secondary">
          {isAivaProduct
            ? 'Sign in with the email and password from signup. Google Sign-In is invite-only until verification finishes.'
            : 'Browser workspace with BYOK inference keys.'}
        </p>
        {isAivaProduct ? (
          <p className="mt-3 rounded-lg border border-border bg-elevated px-3 py-2 text-xs text-text-secondary">
            {googleInviteBlocked
              ? 'Google Sign-In is invite-only until verification finishes. Use email login below, or ask the host to add your Gmail as a tester.'
              : 'If Google shows Access blocked (403), use email sign-in below (or Forgot password). Accounts created with email already work that way.'}
          </p>
        ) : null}
      </div>
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-surface p-6">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {ssoDiscovery?.ssoAvailable ? (
          <div className="space-y-2 rounded-md border border-border bg-base p-3">
            <p className="text-xs text-text-secondary">
              SSO is available for <span className="font-medium text-text-primary">{ssoDiscovery.domain}</span>.
              {ssoDiscovery.ssoRequired ? ' Password sign-in is disabled for members on this domain.' : ''}
            </p>
            <Button type="button" className="w-full" onClick={startSso}>
              Continue with SSO
            </Button>
          </div>
        ) : null}

        {ssoChecking ? <p className="text-xs text-text-muted">Checking SSO...</p> : null}

        {!passwordBlocked ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-xs font-medium text-accent hover:underline">
                Forgot password?
              </Link>
            </div>
            <Input id="password" name="password" type="password" required={!ssoDiscovery?.ssoAvailable} />
          </div>
        ) : (
          <button
            type="button"
            className="text-xs text-accent hover:underline"
            onClick={() => setOwnerPasswordMode(true)}
          >
            Workspace owner? Sign in with password
          </button>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
        {!passwordBlocked ? (
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Signing in...' : 'Sign in'}
          </Button>
        ) : null}
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

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-base" />}>
      <LoginForm />
    </Suspense>
  );
}
