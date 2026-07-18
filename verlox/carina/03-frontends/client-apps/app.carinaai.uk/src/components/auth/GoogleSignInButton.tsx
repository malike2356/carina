'use client';

import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { GoogleLogo } from '@/components/auth/GoogleLogo';

type GoogleSignInButtonProps = {
  callbackURL: string;
  label?: string;
  disabled?: boolean;
  onBeforeRedirect?: () => void | Promise<void>;
  className?: string;
};

export function GoogleSignInButton({
  callbackURL,
  label = 'Continue with Google',
  disabled = false,
  onBeforeRedirect,
  className,
}: GoogleSignInButtonProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function onClick() {
    setPending(true);
    setError('');
    try {
      await onBeforeRedirect?.();
      const result = await authClient.signIn.social({
        provider: 'google',
        callbackURL,
      });
      if (result.error) {
        setError(result.error.message ?? 'Google sign-in failed');
        setPending(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
      setPending(false);
    }
  }

  return (
    <div className={['flex w-full flex-col items-center', className].filter(Boolean).join(' ')}>
      <button
        type="button"
        className="google-auth-btn"
        disabled={disabled || pending}
        onClick={() => void onClick()}
      >
        <GoogleLogo size={18} />
        <span>{pending ? 'Redirecting to Google...' : label}</span>
      </button>
      {error ? <p className="mt-2 text-center text-sm text-danger">{error}</p> : null}
    </div>
  );
}
