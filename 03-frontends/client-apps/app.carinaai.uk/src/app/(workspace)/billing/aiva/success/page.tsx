'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check } from 'lucide-react';

function BillingSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('session_id') ?? '';
  const [status, setStatus] = useState<'polling' | 'confirmed' | 'timeout'>('polling');

  useEffect(() => {
    if (!sessionId) {
      router.replace('/billing/aiva');
      return;
    }

    let attempts = 0;
    const maxAttempts = 15;
    let cancelled = false;
    let timer: number | null = null;

    async function poll() {
      try {
        const res = await fetch('/api/aiva/subscription/status');
        if (res.ok) {
          const data = (await res.json()) as { status?: string; planTier?: string };
          const planTier = String(data.planTier ?? '');
          if (data.status === 'active' && planTier !== 'trial' && planTier) {
            setStatus('confirmed');
            document.cookie = 'aiva_plan_status=active; path=/; max-age=2592000; samesite=lax';
            return;
          }
        }
      } catch {
        // Keep polling until timeout.
      }

      attempts += 1;
      if (attempts >= maxAttempts) {
        setStatus('timeout');
        return;
      }
      if (!cancelled) {
        timer = window.setTimeout(() => void poll(), 2000);
      }
    }

    void poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [router, sessionId]);

  if (status === 'confirmed') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15">
          <Check className="h-7 w-7 text-green-400" />
        </div>
        <h1 className="mb-2 text-2xl font-semibold text-text-primary">Your plan is active</h1>
        <p className="mb-6 max-w-sm text-sm text-text-secondary">
          Payment confirmed. Your Aivas are ready in the workspace.
        </p>
        <Link href="/aiva" className="btn-primary rounded-lg px-4 py-2 text-sm">
          Go to your workspace
        </Link>
      </div>
    );
  }

  if (status === 'timeout') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <h1 className="mb-2 text-xl font-semibold text-text-primary">Payment received</h1>
        <p className="mb-6 max-w-md text-sm text-text-secondary">
          Your payment was received. Your plan will activate within a few minutes. If it does not,
          email support@carinaai.uk with reference: {sessionId}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/billing/aiva" className="btn-primary rounded-lg px-4 py-2 text-sm">
            View billing
          </Link>
          <Link
            href="/aiva"
            className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-elevated"
          >
            Go to workspace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      <h1 className="mb-2 text-xl font-semibold text-text-primary">Payment received</h1>
      <p className="text-sm text-text-secondary">Confirming your plan. This usually takes a few seconds.</p>
    </div>
  );
}

export default function AivaBillingSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      }
    >
      <BillingSuccessContent />
    </Suspense>
  );
}
