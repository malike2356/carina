'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function RevokeKeyButton({ keyId, label }: { keyId: string; label: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function revoke() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/developer/keys/${encodeURIComponent(keyId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed to revoke key');
        setConfirming(false);
        return;
      }
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
      setConfirming(false);
    } finally {
      setPending(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-muted">Revoke &quot;{label}&quot;?</span>
        <Button size="sm" variant="destructive" onClick={revoke} disabled={pending}>
          {pending ? 'Revoking...' : 'Confirm'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setConfirming(false)} disabled={pending}>
          Cancel
        </Button>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    );
  }

  return (
    <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
      Revoke
    </Button>
  );
}
