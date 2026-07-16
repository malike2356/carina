'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

function MobileLoginRedirectInner() {
  const params = useSearchParams();
  const token = params.get('token')?.trim() ?? '';
  const [copied, setCopied] = useState(false);

  const deepLink = useMemo(() => {
    if (!token) return 'carina://login';
    return `carina://login?token=${encodeURIComponent(token)}`;
  }, [token]);

  useEffect(() => {
    if (!token) return;
    window.location.href = deepLink;
  }, [deepLink, token]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center gap-4 px-4 py-10">
      <h1 className="text-xl font-semibold text-text-primary">Open Carina Mobile</h1>
      <p className="text-sm text-text-secondary">
        If the app did not open automatically, copy the login token and paste it in Carina Mobile →
        Scan to sign in.
      </p>
      {token ? (
        <div className="rounded-lg border border-border bg-surface p-3 text-xs">
          <div className="mb-2 break-all font-mono text-text-primary">{token}</div>
          <button
            type="button"
            className="text-accent"
            onClick={() => {
              void navigator.clipboard.writeText(token).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              });
            }}
          >
            {copied ? 'Copied' : 'Copy token'}
          </button>
        </div>
      ) : (
        <p className="text-sm text-text-muted">Missing login token in this link.</p>
      )}
      <a href={deepLink} className="text-sm font-semibold text-accent">
        Open in Carina Mobile
      </a>
    </main>
  );
}

export default function MobileLoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-text-muted">Loading...</div>}>
      <MobileLoginRedirectInner />
    </Suspense>
  );
}
