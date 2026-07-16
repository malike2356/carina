'use client';

import Link from 'next/link';
import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Smartphone } from 'lucide-react';

function PairLandingInner() {
  const params = useSearchParams();
  const token = (params.get('token') ?? '').trim();
  const deepLink = useMemo(
    () => (token ? `carina://pair?token=${encodeURIComponent(token)}` : ''),
    [token],
  );

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center gap-6 px-4 py-12">
      <div className="flex items-center gap-2 text-accent">
        <Smartphone className="h-5 w-5" />
        <h1 className="text-xl font-semibold text-text-primary">Pair with Carina Mobile</h1>
      </div>

      {!token ? (
        <p className="text-sm text-text-secondary">
          Missing pairing token. Open{' '}
          <Link href="/settings/pairing" className="text-accent underline">
            Settings → Device pairing
          </Link>{' '}
          in Carina Cloud and scan the QR from Carina Mobile.
        </p>
      ) : (
        <>
          <p className="text-sm text-text-secondary">
            This link is for the Carina Mobile app. Open it on your phone with Carina Mobile installed,
            or paste the token in the app pair screen.
          </p>
          <a
            href={deepLink}
            className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Open in Carina Mobile
          </a>
          <div className="rounded-lg border border-border bg-surface px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-text-muted">Pairing token</p>
            <p className="mt-1 break-all font-mono text-xs text-text-primary">{token}</p>
          </div>
          <p className="text-xs text-text-muted">
            Developers can also claim via{' '}
            <code className="rounded bg-elevated px-1 py-0.5">POST /api/pair/accept</code> with{' '}
            <code className="rounded bg-elevated px-1 py-0.5">{`{ token, deviceName }`}</code>.
          </p>
        </>
      )}
    </div>
  );
}

export default function PairLandingPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-text-muted">Loading pairing link...</div>}>
      <PairLandingInner />
    </Suspense>
  );
}
