'use client';

import { useEffect, useState } from 'react';
import { BrandMark } from '@/components/shell/BrandMark';

export default function GoogleCompletePage() {
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch('/api/auth/google-complete', {
        method: 'POST',
        credentials: 'include',
      });
      if (cancelled) return;
      if (!res.ok) {
        setError('Could not finish Google sign-in. Try again from the login page.');
        return;
      }
      const data = (await res.json()) as { redirectTo?: string };
      window.location.href = data.redirectTo ?? '/launcher';
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6 text-center">
      <BrandMark className="mx-auto mb-2" size={36} />
      {error ? (
        <>
          <p className="text-sm text-danger">{error}</p>
          <a href="/login" className="text-sm font-medium text-accent hover:underline">
            Back to sign in
          </a>
        </>
      ) : (
        <p className="text-sm text-text-secondary">Finishing Google sign-in...</p>
      )}
    </main>
  );
}
