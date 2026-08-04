'use client';

import { useState, useTransition } from 'react';
import { setScoutPairingAllowed } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ScoutUnlockPanel({
  currentlyAllowed,
  mode = 'self',
}: {
  currentlyAllowed: boolean;
  mode?: 'self' | 'ops';
}) {
  const [opsToken, setOpsToken] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(allowed: boolean) {
    setError(null);
    const fd = new FormData();
    fd.set('opsToken', opsToken);
    fd.set('allowed', allowed ? '1' : '0');
    if (mode === 'ops' && email.trim()) {
      fd.set('email', email.trim());
    }
    startTransition(() => {
      void setScoutPairingAllowed(fd).catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unlock failed');
      });
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-elevated/40 p-4">
      <div>
        <p className="text-sm font-medium text-text-primary">
          {mode === 'ops' ? 'Allow Scout for a tenant' : 'Admin unlock (testing)'}
        </p>
        <p className="mt-1 text-xs text-text-muted">
          Enter the Cloud ops token once in this form. No env file edits needed. Billing plan stays
          unchanged.
        </p>
      </div>
      {mode === 'ops' ? (
        <div className="space-y-2">
          <Label htmlFor="scout-email">Tenant email</Label>
          <Input
            id="scout-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            autoComplete="off"
          />
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="scout-ops-token">Ops token</Label>
        <Input
          id="scout-ops-token"
          type="password"
          value={opsToken}
          onChange={(e) => setOpsToken(e.target.value)}
          placeholder="CARINA_OPS_TOKEN"
          autoComplete="off"
        />
      </div>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={pending || !opsToken.trim() || (mode === 'ops' && !email.trim())}
          onClick={() => submit(true)}
        >
          {currentlyAllowed && mode === 'self' ? 'Keep unlocked' : 'Allow Scout'}
        </Button>
        {currentlyAllowed || mode === 'ops' ? (
          <Button
            type="button"
            variant="ghost"
            disabled={pending || !opsToken.trim() || (mode === 'ops' && !email.trim())}
            onClick={() => submit(false)}
          >
            Revoke unlock
          </Button>
        ) : null}
      </div>
    </div>
  );
}
